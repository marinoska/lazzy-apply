import { randomUUID } from "node:crypto";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Request, Response } from "express";

import { getCloudflareClient } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { Unauthorized, ValidationError } from "@/app/errors.js";
import { FileUploadModel } from "@/models/fileUpload.js";

const SIGNED_URL_TTL_SECONDS = 60;
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

type UploadRequestBody = {
	filename?: string;
	contentType?: string;
	directory?: string;
};

type UploadResponseBody = {
	uploadUrl: string;
	objectKey: string;
	fileId: string;
	expiresIn: number;
};

export const uploadController = async (
	req: Request<unknown, UploadResponseBody, UploadRequestBody>,
	res: Response<UploadResponseBody>,
) => {
	const user = req.user;

	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { filename, contentType, directory } = req.body ?? {};

	if (!filename || typeof filename !== "string") {
		throw new ValidationError("`filename` is required");
	}

	if (contentType && typeof contentType !== "string") {
		throw new ValidationError("`contentType` must be a string");
	}

	if (directory && typeof directory !== "string") {
		throw new ValidationError("`directory` must be a string");
	}

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
	const bucket = getEnv("CLOUDFLARE_BUCKET");

	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: objectKey,
		ContentType: normalizedContentType,
	});

	await FileUploadModel.create({
		fileId,
		objectKey,
		originalFilename: filename,
		contentType: normalizedContentType,
		directory: sanitizedDirectory,
		bucket,
		userId: user.id,
		userEmail: user.email,
		metadata: user.metadata,
		status: "pending",
	});

	const uploadUrl = await getSignedUrl(getCloudflareClient(), command, {
		expiresIn: SIGNED_URL_TTL_SECONDS,
	});

	return res.json({
		uploadUrl,
		objectKey,
		fileId,
		expiresIn: SIGNED_URL_TTL_SECONDS,
	});
};
