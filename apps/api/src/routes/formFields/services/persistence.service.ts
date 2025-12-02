import mongoose from "mongoose";
import { FormFieldModel, FormModel, UsageModel } from "@/formFields/index.js";
import type { CreateFormFieldParams, CreateFormParams, CreateUsageParams, TForm } from "@/formFields/index.js";
import type {
	Field,
	FormFieldClassification,
	FormFieldRef,
	FormInput,
	TokenUsage,
} from "@lazyapply/types";

export interface ClassifiedField {
	hash: string;
	classification: FormFieldClassification;
	paths: string[];
}

/**
 * Builds form field references from classified fields
 */
function buildFormFieldRefs(classifiedFields: ClassifiedField[]): FormFieldRef[] {
	return classifiedFields.map(({ hash, paths }) => ({
		hash,
		path: paths.length === 1 ? paths[0] : paths,
	}));
}

/**
 * Builds form field documents from classified fields
 */
function buildFormFieldDocuments(
	classifiedFields: ClassifiedField[],
	fieldsMap: Map<string, Field>,
): CreateFormFieldParams[] {
	const fieldDocs: CreateFormFieldParams[] = [];

	for (const { hash, classification, paths } of classifiedFields) {
		const originalField = fieldsMap.get(hash);
		if (!originalField) continue;

		const { tag, type, name, label, placeholder, description, isFileUpload, accept } =
			originalField.field;

		fieldDocs.push({
			fieldHash: hash,
			field: { tag, type, name, label, placeholder, description, isFileUpload, accept },
			path: paths.length === 1 ? paths[0] : paths,
			classification: classification.classification,
			linkType: classification.linkType,
		});
	}

	return fieldDocs;
}

/**
 * Persists a new form and its fields to the database in a single transaction.
 * @param allClassifiedFields - All fields for form references (cached + new)
 * @param newlyClassifiedFields - Only new fields to insert into FormField collection
 */
export async function persistNewFormAndFields(
	formInput: FormInput,
	allClassifiedFields: ClassifiedField[],
	newlyClassifiedFields: ClassifiedField[],
	fieldsMap: Map<string, Field>,
	tokenUsage: TokenUsage,
): Promise<void> {
	const session = await mongoose.startSession();

	try {
		await session.withTransaction(async () => {
			const formFieldRefs = buildFormFieldRefs(allClassifiedFields);

			const formData: CreateFormParams = {
				formHash: formInput.formHash,
				fields: formFieldRefs,
				pageUrls: [formInput.pageUrl],
				actions: formInput.action ? [formInput.action] : [],
			};

			const [savedForm] = await FormModel.create([formData], { session });

			// Only insert newly classified fields (not cached ones)
			const fieldDocs = buildFormFieldDocuments(newlyClassifiedFields, fieldsMap);
			if (fieldDocs.length > 0) {
				await FormFieldModel.insertMany(fieldDocs, { session, ordered: false });
			}

			const usageData: CreateUsageParams = {
				referenceTable: "forms",
				reference: savedForm._id,
				type: "form_fields_classification",
				promptTokens: tokenUsage.promptTokens,
				completionTokens: tokenUsage.completionTokens,
				totalTokens: tokenUsage.totalTokens,
				inputCost: tokenUsage.inputCost ?? 0,
				outputCost: tokenUsage.outputCost ?? 0,
				totalCost: tokenUsage.totalCost ?? 0,
			};
			await UsageModel.create([usageData], { session });
		});
	} finally {
		await session.endSession();
	}
}

/**
 * Updates an existing form with new pageUrl/action if not already present
 */
export async function updateFormUrlsIfNeeded(
	existingForm: TForm,
	pageUrl: string,
	action: string | null,
): Promise<void> {
	const updates: Record<string, unknown> = {};

	if (!existingForm.pageUrls.includes(pageUrl)) {
		updates.$addToSet = { ...((updates.$addToSet as Record<string, unknown>) ?? {}), pageUrls: pageUrl };
	}

	if (action && !existingForm.actions.includes(action)) {
		updates.$addToSet = { ...((updates.$addToSet as Record<string, unknown>) ?? {}), actions: action };
	}

	if (Object.keys(updates).length > 0) {
		await FormModel.findOneAndUpdate({ formHash: existingForm.formHash }, updates);
	}
}

