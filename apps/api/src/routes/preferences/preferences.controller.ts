import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { PreferencesModel } from "@/preferences/index.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";

const log = createLogger("preferences");

// PATCH /preferences/selected-upload
export const updateSelectedUploadBodySchema = z.object({
	selectedUploadId: z.string().nullable(),
});

export type UpdateSelectedUploadRequest = z.infer<
	typeof updateSelectedUploadBodySchema
>;

export type UpdateSelectedUploadResponse = {
	selectedUploadId: string | null;
};

export const updateSelectedUploadController = async (
	req: Request<
		unknown,
		UpdateSelectedUploadResponse,
		UpdateSelectedUploadRequest
	>,
	res: Response<UpdateSelectedUploadResponse>,
) => {
	const user = req.user;

	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { selectedUploadId } = req.body;

	log.info(
		{ userId: user.id, selectedUploadId },
		"Updating selected upload preference",
	);

	let uploadObjectId = null;

	if (selectedUploadId) {
		// Validate the ObjectId and verify the upload exists for this user
		if (!mongoose.Types.ObjectId.isValid(selectedUploadId)) {
			return res.status(400).json({ selectedUploadId: null });
		}

		const upload = await FileUploadModel.findById(selectedUploadId)
			.setOptions({ userId: user.id })
			.select("_id")
			.lean()
			.exec();

		if (!upload) {
			return res.status(404).json({ selectedUploadId: null });
		}

		uploadObjectId = upload._id;
	}

	await PreferencesModel.upsertSelectedUpload(user.id, uploadObjectId);

	return res.json({
		selectedUploadId,
	});
};
