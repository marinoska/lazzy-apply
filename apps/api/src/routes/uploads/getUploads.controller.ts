import type { ParseStatus } from "@lazyapply/types";
import type { Request, Response } from "express";
import { z } from "zod";

import { Unauthorized } from "@/app/errors.js";
import { OutboxModel } from "@/outbox/index.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";
import type { TFileUpload } from "@/uploads/fileUpload.types.js";

export const getUploadsQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(100).optional().default(10),
	offset: z.coerce.number().int().min(0).optional().default(0),
});

type GetUploadsQuery = z.infer<typeof getUploadsQuerySchema>;

export type { ParseStatus };

export type UploadDTO = Pick<
	TFileUpload,
	| "fileId"
	| "originalFilename"
	| "contentType"
	| "status"
	| "size"
	| "createdAt"
	| "updatedAt"
> & {
	parseStatus: ParseStatus;
};

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

	// Find uploaded files for the user (exclude failed and deleted)
	const uploads = await FileUploadModel.find({
		status: { $in: ["pending", "uploaded", "deduplicated"] },
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

	// Get fileIds to check parsing status
	const fileIds = uploads.map((u) => u.fileId);

	// Find latest outbox entries for these uploads to get parse status
	const outboxEntries = await OutboxModel.find({
		fileId: { $in: fileIds },
	})
		.select("fileId status")
		.sort({ createdAt: -1 })
		.lean()
		.exec();

	// Build a map of fileId -> latest parse status
	const parseStatusMap = new Map<string, ParseStatus>();
	for (const entry of outboxEntries) {
		if (!parseStatusMap.has(entry.fileId)) {
			parseStatusMap.set(entry.fileId, entry.status);
		}
	}

	// Map uploads to DTOs with parseStatus
	const uploadsWithParseStatus: UploadDTO[] = uploads.map((upload) => ({
		fileId: upload.fileId,
		originalFilename: upload.originalFilename,
		contentType: upload.contentType,
		status: upload.status,
		size: upload.size,
		createdAt: upload.createdAt,
		updatedAt: upload.updatedAt,
		parseStatus: parseStatusMap.get(upload.fileId) ?? "pending",
	}));

	// Get total count for pagination
	const total = await FileUploadModel.countDocuments({
		status: { $in: ["pending", "uploaded", "deduplicated"] },
	}).setOptions({ userId: user.id });

	return res.json({
		uploads: uploadsWithParseStatus,
		total,
		limit,
		offset,
	});
};
