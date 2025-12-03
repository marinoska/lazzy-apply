import type { Request, Response } from "express";
import { z } from "zod";
import { createLogger } from "@/app/logger.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";

const log = createLogger("getRawText");

export const getRawTextParamsSchema = z.object({
	uploadId: z.string().min(1),
});

type GetRawTextParams = z.infer<typeof getRawTextParamsSchema>;

type GetRawTextResponse = {
	rawText: string;
};

/**
 * Get raw text for a file upload
 * Called by the worker to fetch pre-extracted text for CV parsing
 */
export const getRawTextController = async (
	req: Request<GetRawTextParams, GetRawTextResponse>,
	res: Response<GetRawTextResponse | { error: string }>,
) => {
	const { uploadId } = req.params;

	log.info({ uploadId }, "Fetching raw text for upload");

	const fileUpload = await FileUploadModel.findById(uploadId).setOptions({
		skipOwnershipEnforcement: true,
	});

	if (!fileUpload) {
		log.warn({ uploadId }, "Upload not found");
		return res.status(404).json({ error: "Upload not found" });
	}

	if (!fileUpload.rawText) {
		log.warn({ uploadId }, "Raw text not available for upload");
		return res.status(404).json({ error: "Raw text not available" });
	}

	log.info(
		{ uploadId, rawTextLength: fileUpload.rawText.length },
		"Raw text fetched",
	);

	return res.status(200).json({
		rawText: fileUpload.rawText,
	});
};
