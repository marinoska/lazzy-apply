import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { getEnv } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";
import { UPLOAD_DIRECTORY } from "./constants.js";

const log = createLogger("initUpload");

export const initUploadRequestSchema = z.object({
	originalFilename: z.string().min(1),
	contentType: z.enum(["PDF", "DOCX"]),
	userId: z.string().min(1),
	userEmail: z.string().email(),
});

type InitUploadRequest = z.infer<typeof initUploadRequestSchema>;

type InitUploadResponse = {
	fileId: string;
	objectKey: string;
	processId: string;
};

/**
 * Initialize upload - Phase 1 of 2-phase upload flow
 * Creates a pending upload record in MongoDB and returns fileId + objectKey
 * Worker will then store the file in R2 using the returned objectKey
 */
export const initUploadController = async (
	req: Request<unknown, InitUploadResponse, InitUploadRequest>,
	res: Response<InitUploadResponse>,
) => {
	const { originalFilename, contentType, userId, userEmail } = req.body;

	const fileId = randomUUID();
	const processId = randomUUID();
	const objectKey = `${UPLOAD_DIRECTORY}/${fileId}`;
	const bucket = getEnv("CLOUDFLARE_BUCKET");

	log.info(
		{ fileId, processId, objectKey, userId, originalFilename, contentType },
		"Initializing upload - creating pending record",
	);

	// Create pending upload record
	await FileUploadModel.createPendingUpload({
		fileId,
		objectKey,
		originalFilename,
		contentType,
		directory: UPLOAD_DIRECTORY,
		bucket,
		userId,
		userEmail,
	});

	log.info({ fileId, processId, objectKey }, "Pending upload record created");

	return res.status(201).json({
		fileId,
		objectKey,
		processId,
	});
};
