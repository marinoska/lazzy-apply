import { NotFound, ValidationError } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { OutboxModel } from "@/outbox/outbox.model.js";
import { CVDataModel } from "@/cvData/cvData.model.js";
import type { ParsedCVData } from "@lazyapply/types";
import type { Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";

const log = createLogger("update-outbox-status");

export const updateOutboxParamsSchema = z.object({
	logId: z.string().min(1, "logId is required"),
});

export const updateOutboxBodySchema = z
	.object({
		status: z.enum(["completed", "failed"]),
		data: z.any().nullable().optional(), // ParsedCVData
		error: z.string().optional(),
	})
	.refine(
		(body) => {
			// If status is completed, data must be present
			if (body.status === "completed") {
				return !!body.data;
			}
			return true;
		},
		{
			message: "data is required when status is completed",
			path: ["data"],
		},
	);

/**
 * Update outbox entry status
 * Called by the queue consumer worker after processing
 */
export async function updateOutboxStatus(req: Request, res: Response) {
	const { logId } = req.params;
	const { status, data, error } = req.body;

	log.info({ logId, status }, "Updating outbox status");

	const outboxEntry = await OutboxModel.findOne({ logId });
	if (!outboxEntry) {
		throw new NotFound(`Outbox entry not found: ${logId}`);
	}

	if (status === "completed") {
		// Use transaction to ensure atomicity
		const session = await mongoose.startSession();
		await session.withTransaction(async () => {
			// 1. Mark outbox as completed
			await outboxEntry.markAsCompleted();

			// 2. Save parsed CV data (guaranteed to exist due to schema validation)
			const cvDataPayload = {
				uploadId: outboxEntry.uploadId,
				userId: outboxEntry.userId,
				...(data satisfies ParsedCVData),
			};
			
			log.info({ 
				logId, 
				personal: cvDataPayload.personal,
				linksCount: cvDataPayload.links?.length,
				languagesCount: cvDataPayload.languages?.length,
			}, "Saving CV data to database");
			
			await CVDataModel.createCVData(cvDataPayload);

			log.info(
				{ logId, uploadId: outboxEntry.uploadId },
				"Outbox entry marked as completed and CV data saved",
			);
		});
		await session.endSession();
	} else if (status === "failed") {
		await outboxEntry.markAsFailed(error || "Processing failed");
		log.error({ logId, error }, "Outbox entry marked as failed");
	}

	return res.status(200).json({
		success: true,
		logId,
		status: outboxEntry.status,
	});
}
