import type { Request, Response } from "express";
import { z } from "zod";

import { Unauthorized } from "@/app/errors.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";
import type { TFileUpload } from "@/uploads/fileUpload.types.js";

export const getUploadsQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).optional().default(10),
	offset: z.coerce.number().int().min(0).optional().default(0),
});

type GetUploadsQuery = z.infer<typeof getUploadsQuerySchema>;

export type UploadDTO = Pick<
	TFileUpload,
	| "fileId"
	| "originalFilename"
	| "contentType"
	| "status"
	| "size"
	| "createdAt"
	| "updatedAt"
>;

type GetUploadsResponse = {
	uploads: UploadDTO[];
	total: number;
	limit: number;
	offset: number;
};

export const getUploadsController = async (
	req: Request,
	res: Response<GetUploadsResponse>,
) => {
	const user = req.user;

	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { limit, offset } = req.query as unknown as GetUploadsQuery;

	// Find uploaded files for the user (exclude pending, failed, and deleted)
	const uploads = await FileUploadModel.find({
		status: { $in: ["uploaded", "deduplicated"] },
	})
		.setOptions({ userId: user.id })
		.sort({ createdAt: -1 })
		.skip(offset)
		.limit(limit)
		.select(
			"fileId originalFilename contentType status size createdAt updatedAt",
		)
		.lean()
		.exec();

	// Get total count for pagination
	const total = await FileUploadModel.countDocuments({
		status: { $in: ["uploaded", "deduplicated"] },
	}).setOptions({ userId: user.id });

	return res.json({
		uploads: uploads as UploadDTO[],
		total,
		limit,
		offset,
	});
};
