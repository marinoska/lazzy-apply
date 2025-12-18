import type { Request, Response } from "express";
import { z } from "zod";

import { NotFound, Unauthorized } from "@/app/errors.js";
import { PreferencesModel } from "@/domain/preferences/index.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";

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

	const upload = await FileUploadModel.findDeletableByFileId(fileId, user.id);

	if (!upload) {
		throw new NotFound("Upload not found");
	}

	// Mark as deleted
	upload.status = "deleted-by-user";
	await upload.save();

	// Clear from preferences if this was the selected upload
	await PreferencesModel.clearSelectedUploadIfMatches(user.id, upload._id);

	return res.json({
		fileId: upload.fileId,
		status: "deleted-by-user",
	});
};
