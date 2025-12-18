import type { Request, Response } from "express";
import { z } from "zod";

import { Unauthorized } from "@/app/errors.js";
import { PreferencesModel } from "@/domain/preferences/index.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";
import type { UploadWithParseStatus } from "@/domain/uploads/model/fileUpload.statics.js";

const sortFieldSchema = z.enum(["createdAt", "updatedAt"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

export const getUploadsQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).optional().default(10),
	offset: z.coerce.number().int().min(0).optional().default(0),
	sortBy: sortFieldSchema.optional().default("createdAt"),
	sortOrder: sortOrderSchema.optional().default("desc"),
});

export type UploadDTO = UploadWithParseStatus;

type GetUploadsResponse = {
	uploads: UploadDTO[];
	selectedUploadId: string | null;
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

	const { limit, offset, sortBy, sortOrder } = getUploadsQuerySchema.parse(
		req.query,
	);

	// Get uploads with parse status in a single aggregation query
	const { uploads, total } = await FileUploadModel.getUploadsWithParseStatus({
		userId: user.id,
		limit,
		offset,
		sortBy,
		sortOrder,
	});

	// Get selected upload preference
	const preferences = await PreferencesModel.findByUserId(user.id);
	const selectedUploadId = preferences?.selectedUploadId?.toString() ?? null;

	return res.json({
		uploads,
		selectedUploadId,
		total,
		limit,
		offset,
	});
};
