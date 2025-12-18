import { autofillRequestSchema } from "@lazyapply/schemas";
import type {
	AutofillRequest,
	AutofillResponse,
	AutofillResponseData,
} from "@lazyapply/types";
import type { Request, Response } from "express";
import { getPresignedDownloadUrl } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { NotFound, Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { AutofillModel } from "@/domain/autofill/model/autofill.model.js";
import type { AutofillDocument } from "@/domain/autofill/model/autofill.types.js";
import { FormModel } from "@/domain/autofill/model/form.model.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";
import { ClassificationManager } from "./classification.manager.js";

const logger = createLogger("autofill");

export const classifyFormFieldsBodySchema = autofillRequestSchema;

type FreshFileInfo = {
	fileUrl: string;
	fileName: string;
	fileContentType: string;
} | null;

/**
 * Generate fresh presigned URL for file uploads
 * Presigned URLs expire (typically 15 min), so we must regenerate them
 */
async function getFreshFileInfo(
	uploadId: string,
	userId: string,
): Promise<FreshFileInfo> {
	const fileUpload = await FileUploadModel.findOne({
		_id: uploadId,
	}).setOptions({ userId });

	if (!fileUpload) {
		logger.warn(
			{ uploadId },
			"File upload not found for presigned URL refresh",
		);
		return null;
	}

	try {
		const bucket = getEnv("CLOUDFLARE_BUCKET");
		const fileUrl = await getPresignedDownloadUrl(bucket, fileUpload.objectKey);
		return {
			fileUrl,
			fileName: fileUpload.originalFilename,
			fileContentType: fileUpload.contentType,
		};
	} catch (error) {
		logger.error({ uploadId, error }, "Failed to generate fresh presigned URL");
		return null;
	}
}

/**
 * Convert stored autofill document to API response format.
 *
 * IMPORTANT: Presigned URLs for file uploads expire after ~15 minutes.
 * When returning cached autofill data, we must regenerate fresh presigned URLs
 * for file fields. The original URLs stored in the database will be expired
 * and cause CORS/403 errors when the extension tries to fetch them.
 *
 * @see getFreshFileInfo - generates new presigned URLs from R2
 */
async function buildResponseFromAutofillDoc(
	autofillDoc: AutofillDocument,
	uploadId: string,
	userId: string,
): Promise<AutofillResponse> {
	const fields: AutofillResponseData = {};

	for await (const item of autofillDoc.data) {
		if (item.fileUrl && item.fileName && item.fileContentType) {
			// Get fresh file info if needed (presigned URLs expire)
			const freshFileInfo = await getFreshFileInfo(uploadId, userId);
			// Use fresh presigned URL instead of cached one
			fields[item.hash] = {
				fieldName: item.fieldName,
				path: "resume_upload",
				pathFound: !!freshFileInfo,
				fileUrl: freshFileInfo?.fileUrl,
				fileName: freshFileInfo?.fileName ?? item.fileName,
				fileContentType: freshFileInfo?.fileContentType ?? item.fileContentType,
			};
			continue;
		}

		fields[item.hash] = {
			fieldName: item.fieldName,
			path: "unknown",
			pathFound: true,
			value: item.value,
		};
	}

	return {
		autofillId: autofillDoc.autofillId,
		fields,
		fromCache: true,
	};
}

export async function autofill(
	req: Request<unknown, AutofillResponse, AutofillRequest>,
	res: Response<AutofillResponse>,
): Promise<void> {
	const user = req.user;
	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const {
		form,
		fields,
		selectedUploadId,
		jdRawText,
		jdUrl,
		formContext,
		autofillId,
	} = req.body;

	// If autofillId is provided, return stored autofill data directly
	if (autofillId) {
		logger.info({ autofillId }, "Looking up autofill by ID");
		const autofillDoc = await AutofillModel.findByAutofillId(autofillId);
		if (!autofillDoc || autofillDoc.userId !== user.id) {
			throw new NotFound("Autofill not found");
		}
		res.json(
			await buildResponseFromAutofillDoc(
				autofillDoc,
				selectedUploadId,
				user.id,
			),
		);
		return;
	}

	// Check if we have a recent autofill for this user/upload/form combination
	const existingForm = await FormModel.findByHash(form.formHash);
	if (existingForm) {
		const recentAutofill = await AutofillModel.findMostRecentByUserUploadForm(
			user.id,
			selectedUploadId,
			existingForm._id.toString(),
		);
		if (recentAutofill) {
			logger.info(
				{ autofillId: recentAutofill.autofillId },
				"Found recent autofill, returning cached data",
			);
			res.json(
				await buildResponseFromAutofillDoc(
					recentAutofill,
					selectedUploadId,
					user.id,
				),
			);
			return;
		}
	}

	logger.info({ formHash: form.formHash, selectedUploadId }, "Processing form");

	const classificationManager = await ClassificationManager.create({
		selectedUploadId,
		userId: user.id,
		formInput: form,
		fieldsInput: fields,
	});
	const { response, fromCache } = await classificationManager.process({
		jdRawText: jdRawText ?? "",
		jdUrl: jdUrl ?? null,
		formContext: formContext ?? [],
	});

	if (fromCache) {
		logger.info("Returned from DB - no classification needed");
	}

	res.json(response);
}
