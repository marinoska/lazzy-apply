import { createLogger } from "@/app/logger.js";
import { FormModel, type TForm, type TFormField } from "@/formFields/index.js";
import type {
	AutofillResponse,
	AutofillResponseItem,
	Field,
	FormFieldClassification,
	FormFieldPath,
	FormInput,
} from "@lazyapply/types";

import {
	classifyFieldsWithAI,
	findFieldsByHashes,
	persistNewFormAndFields,
	updateFormUrlsIfNeeded,
	type ClassifiedField,
} from "./services/index.js";

const logger = createLogger("classification.manager");

/**
 * Builds autofill response from stored form data, merging fieldId/fieldName from input
 */
function buildResponseFromStoredForm(
	storedForm: TForm,
	inputFields: Field[],
): AutofillResponse {
	const fieldsMap = new Map(inputFields.map((f) => [f.fieldHash, f]));

	return storedForm.fields.map((fieldRef) => {
		const inputField = fieldsMap.get(fieldRef.hash);
		return {
			fieldId: inputField?.field.id ?? "",
			fieldName: inputField?.field.name ?? null,
			path: (Array.isArray(fieldRef.path) ? fieldRef.path[0] : fieldRef.path) as FormFieldPath,
		};
	});
}

/**
 * Builds autofill response from stored fields
 */
function buildResponseFromStoredFields(
	storedFields: Map<string, TFormField>,
	inputFields: Field[],
): AutofillResponse {
	const response: AutofillResponse = [];

	for (const inputField of inputFields) {
		const storedField = storedFields.get(inputField.fieldHash);
		if (storedField) {
			const item: AutofillResponseItem = {
				fieldId: inputField.field.id,
				fieldName: inputField.field.name,
				path: storedField.classification,
			};
			if (storedField.linkType) {
				item.linkType = storedField.linkType;
			}
			response.push(item);
		}
	}

	return response;
}

/**
 * Builds autofill response from classified fields
 */
function buildResponseFromClassifiedFields(
	classifiedFields: ClassifiedField[],
	fieldsMap: Map<string, Field>,
): AutofillResponse {
	const response: AutofillResponse = [];

	for (const classified of classifiedFields) {
		const inputField = fieldsMap.get(classified.hash);
		if (inputField) {
			const item: AutofillResponseItem = {
				fieldId: inputField.field.id,
				fieldName: inputField.field.name,
				path: classified.classification.classification,
			};
			if (classified.classification.linkType) {
				item.linkType = classified.classification.linkType;
			}
			response.push(item);
		}
	}

	return response;
}

/**
 * Converts classifications to ClassifiedField format with paths
 */
function toClassifiedFields(
	classifications: FormFieldClassification[],
	pathsMap: Map<string, string | string[] | null>,
): ClassifiedField[] {
	const byHash = new Map<string, ClassifiedField>();

	for (const classification of classifications) {
		const { hash } = classification;
		const fieldPath = pathsMap.get(hash);
		const paths: string[] = fieldPath
			? (Array.isArray(fieldPath) ? fieldPath : [fieldPath])
			: [];

		const existing = byHash.get(hash);
		if (existing) {
			for (const p of paths) {
				if (!existing.paths.includes(p)) {
					existing.paths.push(p);
				}
			}
		} else {
			byHash.set(hash, {
				hash,
				classification,
				paths: [...paths],
			});
		}
	}

	return Array.from(byHash.values());
}

export interface AutofillResult {
	response: AutofillResponse;
	fromCache: boolean;
}

/**
 * Main orchestration function for autofill classification
 *
 * Flow:
 * 1. Check if form exists in DB → return cached data (update URLs if needed)
 * 2. If no form, look up fields by hash → classify only missing ones
 * 3. Merge cached + newly classified fields
 * 4. Persist new data
 */
export async function processAutofillRequest(
	formInput: FormInput,
	inputFields: Field[],
): Promise<AutofillResult> {
	const fieldsMap = new Map(inputFields.map((f) => [f.fieldHash, f]));
	const fieldHashes = inputFields.map((f) => f.fieldHash);
	// Build pathsMap from formInput.fields (FormFieldRef[]) - this is where paths come from
	const pathsMap = new Map(formInput.fields.map((ref) => [ref.hash, ref.path]));

	// Step 1: Check if form exists
	const existingForm = await FormModel.findByHash(formInput.formHash);

	if (existingForm) {
		logger.info("Form found in DB, returning cached data");

		// Update URLs if changed
		await updateFormUrlsIfNeeded(existingForm, formInput.pageUrl, formInput.action);

		return {
			response: buildResponseFromStoredForm(existingForm, inputFields),
			fromCache: true,
		};
	}

	// Step 2: No form found - look up fields by hash
	logger.info("Form not found, looking up fields by hash");
	const { found: cachedFields, missing: missingHashes } = await findFieldsByHashes(fieldHashes);

	// Step 3: Classify only missing fields
	let newlyClassified: ClassifiedField[] = [];
	let tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

	if (missingHashes.length > 0) {
		logger.info({ count: missingHashes.length }, "Classifying missing fields");
		const fieldsToClassify = inputFields.filter((f) => missingHashes.includes(f.fieldHash));
		const { classifications, usage } = await classifyFieldsWithAI(fieldsToClassify);
		tokenUsage = usage;
		newlyClassified = toClassifiedFields(classifications, pathsMap);
	} else {
		logger.info("All fields found in cache");
	}

	// Step 4: Build merged response
	const cachedResponse = buildResponseFromStoredFields(cachedFields, inputFields);
	const newResponse = buildResponseFromClassifiedFields(newlyClassified, fieldsMap);
	const mergedResponse = [...cachedResponse, ...newResponse];

	// Step 5: Build all field refs for the form (cached + new)
	const allClassifiedFields: ClassifiedField[] = [
		// Convert cached fields to ClassifiedField format (for form refs only)
		...Array.from(cachedFields.entries()).map(([hash, stored]) => {
			const fieldPath = pathsMap.get(hash);
			const paths: string[] = fieldPath
				? (Array.isArray(fieldPath) ? fieldPath : [fieldPath])
				: [];
			return {
				hash,
				classification: {
					hash,
					classification: stored.classification,
					linkType: stored.linkType,
				},
				paths,
			};
		}),
		...newlyClassified,
	];

	// Persist form with all field refs, but only insert newly classified fields
	await persistNewFormAndFields(formInput, allClassifiedFields, newlyClassified, fieldsMap, tokenUsage);

	return {
		response: mergedResponse,
		fromCache: false,
	};
}
