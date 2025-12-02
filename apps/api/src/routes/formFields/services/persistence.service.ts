import type {
	FormFieldRef,
	FormInput,
	TokenUsage,
} from "@lazyapply/types";
import mongoose from "mongoose";
import { FormModel } from "@/formFields/form.model.js";
import {
	type CreateFormFieldParams,
	type CreateFormParams,
	type CreateUsageParams,
	FormFieldModel,
	type TFormField,
	UsageModel,
} from "@/formFields/index.js";
import type { EnrichedClassifiedField } from "./classifier.service.js";

/**
 * Builds form field references from classified fields
 */
function buildFormFieldRefs(
	classifiedFields: (EnrichedClassifiedField | TFormField)[],
): FormFieldRef[] {
	return classifiedFields.map(({ hash, classification, linkType }) => ({
		hash,
		classification,
		...(linkType && { linkType }),
	}));
}

/**
 * Builds form field documents from classified fields
 */
function buildFormFieldDocuments(
	classifiedFields: EnrichedClassifiedField[],
): CreateFormFieldParams[] {
	const fieldDocs: CreateFormFieldParams[] = [];

	for (const { hash, classification, linkType, field } of classifiedFields) {
		fieldDocs.push({
			hash: hash,
			field: {
				tag: field.tag,
				type: field.type,
				name: field.name,
				label: field.label,
				placeholder: field.placeholder,
				description: field.description,
				isFileUpload: field.isFileUpload,
				accept: field.accept,
			},
			classification,
			linkType,
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
	allClassifiedFields: (TFormField | EnrichedClassifiedField)[],
	newlyClassifiedFields: EnrichedClassifiedField[],
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

			// Only_savedFormewly classified fields (not cached ones)
			const fieldDocs = buildFormFieldDocuments(newlyClassifiedFields);
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
