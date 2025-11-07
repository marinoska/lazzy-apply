import { randomUUID } from "node:crypto";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Request, Response } from "express";

import { z } from "zod";

import { getCloudflareClient } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { Unauthorized } from "@/app/errors.js";
import { FileUploadModel } from "@/models/fileUpload.js";

const SIGNED_URL_TTL_SECONDS = 60;
const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const MAXIMUM_UPLOAD_SIZE_BYTES = 3145728; // 3MB

// Map MIME types to file types for database storage
const MIME_TO_FILE_TYPE: Record<string, "PDF" | "DOCX"> = {
	"application/pdf": "PDF",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

export const uploadRequestSchema = z.object({
	filename: z
		.string({ required_error: "`filename` is required" })
		.min(1, "`filename` is required"),
	contentType: z
		.string({ required_error: "`contentType` is req" })
		.min(3, "`contentType` is required"),
	fileSize: z
		.number({ required_error: "`fileSize` is required" })
		.int()
		.positive()
		.max(MAXIMUM_UPLOAD_SIZE_BYTES, `File size must not exceed ${MAXIMUM_UPLOAD_SIZE_BYTES} bytes`),
	directory: z
		.string({ invalid_type_error: "`directory` must be a string" })
		.optional(),
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

	const { filename, contentType, fileSize, directory } = req.body ?? {};

	const sanitizedDirectory =
		directory?.replace(/\\/g, "/").replace(/(^\/+|\/+$)/g, "") ?? "";

	const fileId = randomUUID();
	const objectKeyParts = [];

	if (sanitizedDirectory.length > 0) {
		objectKeyParts.push(sanitizedDirectory);
	}

	objectKeyParts.push(fileId);

	const objectKey = objectKeyParts.join("/");
	const normalizedContentType = contentType ?? DEFAULT_CONTENT_TYPE;
	const fileType = MIME_TO_FILE_TYPE[normalizedContentType];
	
	if (!fileType) {
		throw new Error(`Unsupported content type: ${normalizedContentType}`);
	}
	
	const bucket = getEnv("CLOUDFLARE_BUCKET");

	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: objectKey,
		ContentType: normalizedContentType,
		ContentLength: fileSize,
	});

	const uploadUrl = await getSignedUrl(getCloudflareClient(), command, {
		expiresIn: SIGNED_URL_TTL_SECONDS,
		unhoistableHeaders: new Set(["x-amz-checksum-crc32", "content-length"]),
	});
	const uploadUrlExpiresAt = new Date(
		Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
	);

	await FileUploadModel.create({
		fileId,
		objectKey,
		originalFilename: filename,
		contentType: fileType,
		directory: sanitizedDirectory,
		bucket,
		userId: user.id,
		userEmail: user.email,
		status: "pending",
		uploadUrlExpiresAt,
	});

	return res.json({
		uploadUrl,
		objectKey,
		fileId,
		expiresIn: SIGNED_URL_TTL_SECONDS,
	});
};
