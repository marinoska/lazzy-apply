import { randomUUID } from "node:crypto";
import type { FormFieldRef, FormInput, TokenUsage } from "@lazyapply/types";
import mongoose, { type ClientSession, type Types } from "mongoose";
import { FormModel } from "@/formFields/form.model.js";
import {
	type CreateFormFieldParams,
	type CreateFormParams,
	type CreateUsageParams,
	FormFieldModel,
	type TFormField,
	UsageModel,
	type UsageType,
} from "@/formFields/index.js";
import type { EnrichedClassifiedField } from "./classifier.service.js";

/**
 * Builds form field references from classified fields
 */
function buildFormFieldRefs(
	classifiedFields: (EnrichedClassifiedField | TFormField)[],
): FormFieldRef[] {
	return classifiedFields.map(
		({ hash, classification, linkType, inferenceHint }) => ({
			hash,
			classification,
			...(linkType && { linkType }),
			...(inferenceHint && { inferenceHint }),
		}),
	);
}

/**
 * Builds form field documents from classified fields
 */
function buildFormFieldDocuments(
	classifiedFields: EnrichedClassifiedField[],
): CreateFormFieldParams[] {
	const fieldDocs: CreateFormFieldParams[] = [];

	for (const {
		hash,
		classification,
		linkType,
		inferenceHint,
		field,
	} of classifiedFields) {
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
			inferenceHint,
		});
	}

	return fieldDocs;
}

/**
 * Creates a usage record for an LLM call
 */
async function createUsageRecord(
	session: ClientSession,
	reference: Types.ObjectId,
	userId: string,
	autofillId: string,
	type: UsageType,
	usage: TokenUsage,
): Promise<void> {
	const usageData: CreateUsageParams = {
		referenceTable: "forms",
		reference,
		userId,
		autofillId,
		type,
		promptTokens: usage.promptTokens,
		completionTokens: usage.completionTokens,
		totalTokens: usage.totalTokens,
		inputCost: usage.inputCost ?? 0,
		outputCost: usage.outputCost ?? 0,
		totalCost: usage.totalCost ?? 0,
	};
	await UsageModel.create([usageData], { session });
}

/**
 * Persists a new form and its fields to the database in a single transaction.
 * @param allClassifiedFields - All fields for form references (cached + new)
 * @param newlyClassifiedFields - Only new fields to insert into FormField collection
 * @param userId - User who triggered the autofill
 * @param classificationUsage - Token usage from classification LLM call
 * @param inferenceUsage - Optional token usage from inference LLM call
 * @param jdMatchUsage - Optional token usage from JD-form match LLM call
 */
export async function persistNewFormAndFields(
	formInput: FormInput,
	allClassifiedFields: (TFormField | EnrichedClassifiedField)[],
	newlyClassifiedFields: EnrichedClassifiedField[],
	userId: string,
	classificationUsage: TokenUsage,
	inferenceUsage?: TokenUsage,
	jdMatchUsage?: TokenUsage,
): Promise<void> {
	const session = await mongoose.startSession();
	const autofillId = randomUUID();

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
			const fieldDocs = buildFormFieldDocuments(newlyClassifiedFields);
			if (fieldDocs.length > 0) {
				await FormFieldModel.insertMany(fieldDocs, { session, ordered: false });
			}

			// Persist usage records
			await createUsageRecord(
				session,
				savedForm._id,
				userId,
				autofillId,
				"form_fields_classification",
				classificationUsage,
			);

			if (inferenceUsage && inferenceUsage.totalTokens > 0) {
				await createUsageRecord(
					session,
					savedForm._id,
					userId,
					autofillId,
					"form_fields_inference",
					inferenceUsage,
				);
			}

			if (jdMatchUsage && jdMatchUsage.totalTokens > 0) {
				await createUsageRecord(
					session,
					savedForm._id,
					userId,
					autofillId,
					"jd_form_match",
					jdMatchUsage,
				);
			}
		});
	} finally {
		await session.endSession();
	}
}
