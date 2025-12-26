import { randomUUID } from "node:crypto";
import type { AutofillResponseData, FormInput } from "@lazyapply/types";
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
	type FormDocumentPopulated,
	FormFieldModel,
	type TFormField,
} from "@/domain/autofill/index.js";
import { FormModel } from "@/domain/autofill/model/form.model.js";
import type { TFormFieldRef } from "@/domain/autofill/model/formField.types.js";
import type { EnrichedClassifiedField } from "../llm/classifier.llm.js";

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
 * Creates an autofill record with the response data
 * Stores all fields needed for AutofillResponseItem so cached responses match first-time responses
 */
async function createAutofillRecord(
	session: ClientSession,
	formReference: Types.ObjectId,
	uploadReference: Types.ObjectId,
	cvDataReference: Types.ObjectId,
	userId: string,
	autofillResponse: AutofillResponseData,
	fieldHashToIdMap: Map<string, Types.ObjectId>,
	jdRawText: string,
	formContext: string,
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
			label: item.label,
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
				autofillId: randomUUID(),
				formReference,
				uploadReference,
				cvDataReference: cvDataReference,
				jdRawText,
				formContext,
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
 * @returns The created form document with populated fields
 */
export async function persistNewFormAndFields(
	formInput: FormInput,
	allClassifiedFields: (TFormField | EnrichedClassifiedField)[],
	newlyClassifiedFields: EnrichedClassifiedField[],
): Promise<FormDocumentPopulated> {
	const session = await mongoose.startSession();

	try {
		await session.withTransaction(async () => {
			// Only insert newly classified fields (not cached ones)
			const fieldDocs = buildFormFieldDocuments(newlyClassifiedFields);
			if (fieldDocs.length) {
				await FormFieldModel.insertMany(fieldDocs, { session, ordered: false });
			}

			// Build field hash to ID map for fieldRefs
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

			await FormModel.create([formData], { session });
		});

		const createdForm = await FormModel.findByHash(formInput.formHash, {
			populate: true,
		});

		if (!createdForm) {
			throw new Error("Failed to create form: transaction aborted");
		}

		return createdForm;
	} finally {
		await session.endSession();
	}
}

/**
 * Persists autofill data for cached responses (no new form/fields created)
 * @returns The created autofill document
 */
export async function persistAutofill(
	formId: Types.ObjectId,
	uploadId: string,
	cvDataId: string,
	userId: string,
	autofillResponse: AutofillResponseData,
	fieldHashToIdMap: Map<string, Types.ObjectId>,
	jdRawText?: string,
	formContext?: string,
): Promise<AutofillDocument> {
	const session = await mongoose.startSession();
	let autofillDoc: AutofillDocument | null = null;

	try {
		await session.withTransaction(async () => {
			// Persist autofill record
			autofillDoc = await createAutofillRecord(
				session,
				formId,
				new mongoose.Types.ObjectId(uploadId),
				new mongoose.Types.ObjectId(cvDataId),
				userId,
				autofillResponse,
				fieldHashToIdMap,
				jdRawText ?? "",
				formContext ?? "",
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
