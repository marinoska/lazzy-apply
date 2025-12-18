import type { Request, Response } from "express";
import { z } from "zod";
import { getPresignedDownloadUrl } from "@/app/cloudflare.js";
import { getEnv } from "@/app/env.js";
import { NotFound, Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";

const logger = createLogger("downloadUpload.controller");

export const downloadUploadParamsSchema = z.object({
	fileId: z.string().uuid(),
});

type DownloadUploadParams = z.infer<typeof downloadUploadParamsSchema>;

export type DownloadUploadResponse = {
	downloadUrl: string;
	filename: string;
};

export const downloadUploadController = async (
	req: Request<DownloadUploadParams>,
	res: Response<DownloadUploadResponse>,
) => {
	const user = req.user;

	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { fileId } = req.params;

	const upload = await FileUploadModel.findOne({ fileId }).setOptions({
		userId: user.id,
	});

	if (!upload) {
		throw new NotFound("Upload not found");
	}

	const bucket = getEnv("CLOUDFLARE_BUCKET");
	const downloadUrl = await getPresignedDownloadUrl(bucket, upload.objectKey);

	logger.info({ fileId }, "Generated download URL");
	res.json({ downloadUrl, filename: upload.originalFilename });
};
