import type { Request, Response } from "express";
import { z } from "zod";

import { NotFound, Unauthorized } from "@/app/errors.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";

export const deleteUploadParamsSchema = z.object({
	fileId: z.string().uuid(),
});

type DeleteUploadParams = z.infer<typeof deleteUploadParamsSchema>;

type DeleteUploadResponse = {
	fileId: string;
	status: "deleted-by-user";
};

export const deleteUploadController = async (
	req: Request<DeleteUploadParams>,
	res: Response<DeleteUploadResponse>,
) => {
	const user = req.user;

	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { fileId } = req.params;

	// Find the upload
	const upload = await FileUploadModel.findOne({
		fileId,
		status: { $in: ["uploaded", "deduplicated", "failed"] },
	}).setOptions({ userId: user.id });

	if (!upload) {
		throw new NotFound("Upload not found");
	}

	// Mark as deleted
	upload.status = "deleted-by-user";
	await upload.save();

	return res.json({
		fileId: upload.fileId,
		status: "deleted-by-user",
	});
};
