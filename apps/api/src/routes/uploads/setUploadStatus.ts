import type { Request, Response } from "express";
import { z } from "zod";

import { NotFound, Unauthorized } from "@/app/errors.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";
import { completeUpload } from "@/uploads/updateStatus.service.js";
import type { UploadStatus } from "./constants.js";

export const completeUploadRequestSchema = z.object({
	fileId: z
		.string({ required_error: "`fileId` is required" })
		.min(1, "`fileId` is required"),
});

type CompleteUploadRequest = z.infer<typeof completeUploadRequestSchema>;

type CompleteUploadResponse = {
	fileId: string;
	status: UploadStatus;
	deduplicated?: boolean;
};

export const completeUploadController = async (
	req: Request<unknown, CompleteUploadResponse, CompleteUploadRequest>,
	res: Response<CompleteUploadResponse>,
) => {
	const user = req.user;

	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { fileId } = req.body;

	// Find the file upload record in pending status
	const fileUpload = await FileUploadModel.findOne({
		fileId,
		status: "pending",
	}).setOptions({ userId: user.id });

	if (!fileUpload) {
		throw new NotFound(`Pending upload ${fileId} was not found for this user`);
	}

	// Validate file in quarantine and promote to healthy directory
	// Throws error if file not ready - client should retry
	const payload = await completeUpload(fileUpload);

	return res.json(payload);
};
