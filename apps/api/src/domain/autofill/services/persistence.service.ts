import { randomUUID } from "node:crypto";
import type {
	AutofillResponseData,
	FormInput,
	TokenUsage,
} from "@lazyapply/types";
import type { Types } from "mongoose";
import mongoose, { type ClientSession } from "mongoose";
import {
	type AutofillDataItem,
	type AutofillDataItemFile,
	type AutofillDataItemText,
	type AutofillDocument,
	AutofillModel,
	type CreateFormFieldParams,
	type CreateFormParams,
	FormFieldModel,
	type TFormField,
} from "@/domain/autofill/index.js";
import { FormModel } from "@/domain/autofill/model/form.model.js";
import type { TFormFieldRef } from "@/domain/autofill/model/formField.types.js";
import {
	type CreateUsageParams,
	UsageModel,
	type UsageType,
} from "@/domain/usage/index.js";
import type { EnrichedClassifiedField } from "./classifier.service.js";

/**
 * Builds form field references from classified fields with their ObjectId refs
 */
function buildFormFieldRefs(
	classifiedFields: (EnrichedClassifiedField | TFormField)[],
	fieldHashToIdMap: Map<string, Types.ObjectId>,
): TFormFieldRef[] {
	return classifiedFields
		.map(({ hash, classification, linkType, inferenceHint }) => {
			const fieldRef = fieldHashToIdMap.get(hash);
			if (!fieldRef) return null;
			return {
				hash,
				classification,
				fieldRef,
				...(linkType && { linkType }),
				...(inferenceHint && { inferenceHint }),
			};
		})
		.filter((f): f is TFormFieldRef => f !== null);
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
 * Creates an autofill record with the response data
 * Stores all fields needed for AutofillResponseItem so cached responses match first-time responses
 */
async function createAutofillRecord(
	session: ClientSession,
	formReference: Types.ObjectId,
	uploadReference: Types.ObjectId,
	userId: string,
	autofillId: string,
	autofillResponse: AutofillResponseData,
	fieldHashToIdMap: Map<string, Types.ObjectId>,
): Promise<AutofillDocument> {
	const data: AutofillDataItem[] = [];

	for (const [hash, item] of Object.entries(autofillResponse)) {
		const fieldRef = fieldHashToIdMap.get(hash);
		if (!fieldRef) {
			continue;
		}

		const baseItem = {
			hash,
			fieldRef,
			fieldName: item.fieldName ?? "",
			path: item.path,
			pathFound: item.pathFound,
			...(item.linkType && { linkType: item.linkType }),
			...(item.inferenceHint && { inferenceHint: item.inferenceHint }),
		};

		// Handle file upload fields
		if (item.fileUrl && item.fileName && item.fileContentType) {
			const fileItem: AutofillDataItemFile = {
				...baseItem,
				fileUrl: item.fileUrl,
				fileName: item.fileName,
				fileContentType: item.fileContentType,
			};
			data.push(fileItem);
			continue;
		}

		// Handle text value fields
		const textItem: AutofillDataItemText = {
			...baseItem,
			value: item.value ?? null,
		};
		data.push(textItem);
	}

	const [autofill] = await AutofillModel.create(
		[
			{
				userId,
				autofillId,
				formReference,
				uploadReference,
				data,
			},
		],
		{ session },
	);
	return autofill;
}

/**
 * Persists a new form and its fields to the database in a single transaction.
 * @param allClassifiedFields - All fields for form references (cached + new)
 * @param newlyClassifiedFields - Only new fields to insert into FormField collection
 * @param userId - User who triggered the autofill
 * @param uploadId - Upload ID (CV) used for this autofill
 * @param autofillResponse - The autofill response to save
 * @param classificationUsage - Token usage from classification LLM call
 * @param inferenceUsage - Optional token usage from inference LLM call
 * @param jdMatchUsage - Optional token usage from JD-form match LLM call
 * @returns The created autofill document
 */
export async function persistNewFormAndFields(
	formInput: FormInput,
	allClassifiedFields: (TFormField | EnrichedClassifiedField)[],
	newlyClassifiedFields: EnrichedClassifiedField[],
	userId: string,
	uploadId: string,
	autofillResponse: AutofillResponseData,
	classificationUsage: TokenUsage,
	inferenceUsage?: TokenUsage,
	jdMatchUsage?: TokenUsage,
): Promise<AutofillDocument> {
	const autofillId = randomUUID();
	const session = await mongoose.startSession();
	let autofillDoc: AutofillDocument | null = null;

	try {
		await session.withTransaction(async () => {
			// Only insert newly classified fields (not cached ones)
			const fieldDocs = buildFormFieldDocuments(newlyClassifiedFields);
			if (fieldDocs.length) {
				await FormFieldModel.insertMany(fieldDocs, { session, ordered: false });
			}

			// Build field hash to ID map for autofill record and fieldRefs
			const hashes = allClassifiedFields.map((f) => f.hash);
			const existingFields = await FormFieldModel.find(
				{ hash: { $in: hashes } },
				{ hash: 1, _id: 1 },
			).session(session);
			const fieldHashToIdMap = new Map(
				existingFields.map((f) => [f.hash, f._id as Types.ObjectId]),
			);

			const formFieldRefs = buildFormFieldRefs(
				allClassifiedFields,
				fieldHashToIdMap,
			);

			const formData: CreateFormParams = {
				formHash: formInput.formHash,
				fields: formFieldRefs,
				pageUrl: formInput.pageUrl,
				action: formInput.action,
			};

			const [savedForm] = await FormModel.create([formData], { session });

			// Persist autofill record
			autofillDoc = await createAutofillRecord(
				session,
				savedForm._id,
				new mongoose.Types.ObjectId(uploadId),
				userId,
				autofillId,
				autofillResponse,
				fieldHashToIdMap,
			);

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

		if (!autofillDoc) {
			throw new Error("Failed to persist autofill: transaction aborted");
		}
		return autofillDoc;
	} finally {
		await session.endSession();
	}
}

/**
 * Persists autofill data for cached responses (no new form/fields created)
 * Creates empty usage record and saves autofill result
 * @returns The created autofill document
 */
export async function persistCachedAutofill(
	formId: Types.ObjectId,
	uploadId: string,
	userId: string,
	autofillResponse: AutofillResponseData,
): Promise<AutofillDocument> {
	const autofillId = randomUUID();
	const session = await mongoose.startSession();
	let autofillDoc: AutofillDocument | null = null;

	try {
		await session.withTransaction(async () => {
			// Build field hash to ID map
			const hashes = Object.keys(autofillResponse);
			const existingFields = await FormFieldModel.find(
				{ hash: { $in: hashes } },
				{ hash: 1, _id: 1 },
			).session(session);
			const fieldHashToIdMap = new Map(
				existingFields.map((f) => [f.hash, f._id as Types.ObjectId]),
			);

			// Persist autofill record
			autofillDoc = await createAutofillRecord(
				session,
				formId,
				new mongoose.Types.ObjectId(uploadId),
				userId,
				autofillId,
				autofillResponse,
				fieldHashToIdMap,
			);

			// Create empty usage record for tracking
			await createUsageRecord(
				session,
				formId,
				userId,
				autofillId,
				"form_fields_classification",
				{
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0,
					inputCost: 0,
					outputCost: 0,
					totalCost: 0,
				},
			);
		});

		if (!autofillDoc) {
			throw new Error("Failed to persist cached autofill: transaction aborted");
		}
		return autofillDoc;
	} finally {
		await session.endSession();
	}
}
