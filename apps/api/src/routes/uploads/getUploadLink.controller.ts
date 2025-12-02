import { randomUUID } from "node:crypto";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Request, Response } from "express";

import { z } from "zod";

import { getCloudflareClient } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { Unauthorized } from "@/app/errors.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";
import {
	MAXIMUM_UPLOAD_SIZE_BYTES,
	QUARANTINE_DIRECTORY,
	SIGNED_URL_TTL_SECONDS,
} from "./constants.js";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

// Map MIME types to file types for database storage
const MIME_TO_FILE_TYPE: Record<string, "PDF" | "DOCX"> = {
	"application/pdf": "PDF",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		"DOCX",
};

export const uploadRequestSchema = z.object({
	filename: z
		.string({ required_error: "`filename` is required" })
		.min(1, "`filename` is required"),
	contentType: z.enum(
		[
			"application/pdf",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		],
		{ required_error: "`contentType` is required" },
	),
	fileSize: z
		.number({ required_error: "`fileSize` is required" })
		.int()
		.positive()
		.max(
			MAXIMUM_UPLOAD_SIZE_BYTES,
			`File size must not exceed ${MAXIMUM_UPLOAD_SIZE_BYTES} bytes`,
		),
});

type UploadRequestBody = z.infer<typeof uploadRequestSchema>;

type UploadResponseBody = {
	uploadUrl: string;
	objectKey: string;
	fileId: string;
	expiresIn: number;
};

export const uploadLinkController = async (
	req: Request<unknown, UploadResponseBody, UploadRequestBody>,
	res: Response<UploadResponseBody>,
) => {
	const user = req.user;

	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { filename, contentType, fileSize } = req.body;

	const fileId = randomUUID();
	const objectKey = `${QUARANTINE_DIRECTORY}/${fileId}`;

	const fileType = MIME_TO_FILE_TYPE[contentType];

	const bucket = getEnv("CLOUDFLARE_BUCKET");
	const client = getCloudflareClient();

	// Create a PUT command for the object
	// Note: Don't include ContentLength in the signature as browsers handle it automatically
	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: objectKey,
		ContentType: contentType,
	});

	// Generate presigned URL for PUT request (R2 compatible)
	const uploadUrl = await getSignedUrl(client, command, {
		expiresIn: SIGNED_URL_TTL_SECONDS,
	});

	const uploadUrlExpiresAt = new Date(
		Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
	);

	await FileUploadModel.createPendingUpload({
		fileId,
		objectKey,
		originalFilename: filename,
		contentType: fileType,
		directory: QUARANTINE_DIRECTORY,
		bucket,
		userId: user.id,
		userEmail: user.email,
		uploadUrlExpiresAt,
	});

	return res.json({
		uploadUrl,
		objectKey,
		fileId,
		expiresIn: SIGNED_URL_TTL_SECONDS,
	});
};
