import type { HeadObjectCommandOutput } from "@aws-sdk/client-s3";
import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import type { Request, Response } from "express";
import { z } from "zod";

import { getCloudflareClient } from "@/app/cloudflare.js";
import { NotFound, Unauthorized } from "@/app/errors.js";
import {
	type FileUploadDocument,
	FileUploadModel,
} from "@/models/fileUpload.js";

const uploadStatusValues = ["uploaded", "failed"] as const;
const MAXIMUM_UPLOAD_SIZE_BYTES = 3145728; // 3MB

export const setUploadStatusRequestSchema = z.object({
	fileId: z
		.string({ required_error: "`fileId` is required" })
		.min(1, "`fileId` is required"),
	status: z.enum(uploadStatusValues, {
		errorMap: () => ({
			message: "`status` must be either `success` or `failure`",
		}),
	}),
	size: z.number().int().nonnegative().optional(),
});

type SetUploadStatusRequest = z.infer<typeof setUploadStatusRequestSchema>;

type SetUploadStatusResponse = {
	fileId: string;
	status: (typeof uploadStatusValues)[number];
};

export const setUploadStatusController = async (
	req: Request<unknown, SetUploadStatusResponse, SetUploadStatusRequest>,
	res: Response<SetUploadStatusResponse>,
) => {
	const user = req.user;

	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { fileId, status, size: clientSize } = req.body;

	// Find the file upload record to get the object key and bucket
	const fileUpload = await FileUploadModel.findOne({
		fileId,
		userId: user.id,
	});

	if (!fileUpload) {
		throw new NotFound(`Upload ${fileId} was not found for this user`);
	}

	const update: Partial<FileUploadDocument> = { status };

	// If status is "uploaded", verify the file exists and get its actual size from R2
	if (status === "uploaded") {
		let headResult: HeadObjectCommandOutput | undefined;
		try {
			const headCommand = new HeadObjectCommand({
				Bucket: fileUpload.bucket,
				Key: fileUpload.objectKey,
			});

			headResult = await getCloudflareClient().send(headCommand);
		} catch (error) {
			// If the file doesn't exist in R2, mark as failed
			update.status = "failed";
		}

		// Use the actual file size from R2, not from the client
		if (headResult?.ContentLength !== undefined) {
			const actualSize = headResult.ContentLength;

			// Verify client-reported size matches actual size (detect tampering)
			if (clientSize !== undefined && clientSize !== actualSize) {
				console.warn(
					`Size mismatch for file ${fileId}: client reported ${clientSize} bytes, actual ${actualSize} bytes`,
				);
			}

			// Check if file size exceeds the limit
			if (actualSize > MAXIMUM_UPLOAD_SIZE_BYTES) {
				// Delete the file from R2
				const deleteCommand = new DeleteObjectCommand({
					Bucket: fileUpload.bucket,
					Key: fileUpload.objectKey,
				});
				await getCloudflareClient().send(deleteCommand);

				// Delete the database record
				// await FileUploadModel.deleteOne({ fileId, userId: user.id });

				throw new Error(
					`File size (${actualSize} bytes) exceeds maximum allowed size (${MAXIMUM_UPLOAD_SIZE_BYTES} bytes)`,
				);
			}

			update.size = actualSize;
		}
	}

	const updatedFileUpload = await FileUploadModel.findOneAndUpdate(
		{ fileId, userId: user.id },
		{ $set: update },
		{ new: true },
	);

	if (!updatedFileUpload) {
		throw new NotFound(`Upload ${fileId} was not found for this user`);
	}

	return res.json({
		fileId: updatedFileUpload.fileId,
		status: updatedFileUpload.status as (typeof uploadStatusValues)[number],
	});
};
