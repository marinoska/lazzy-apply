import { randomUUID } from "node:crypto";
import type { AutofillResponseData } from "@lazyapply/types";
import type { Types } from "mongoose";
import mongoose, { type ClientSession } from "mongoose";
import {
	type AutofillDataItem,
	type AutofillDataItemFile,
	type AutofillDataItemText,
	type AutofillDocument,
	AutofillModel,
} from "@/domain/autofill/index.js";

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
