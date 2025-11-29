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
	processId: z.string().min(1, "processId is required"),
});

export const updateOutboxBodySchema = z
	.object({
		status: z.enum(["completed", "failed"]),
		data: z.any().nullable().optional(), // ParsedCVData
		error: z.string().optional(),
		usage: z.object({
			promptTokens: z.number(),
			completionTokens: z.number(),
			totalTokens: z.number(),
		}).optional(),
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
	const { processId } = req.params;
	const { status, data, error, usage } = req.body;

	log.info({ processId, status }, "Updating outbox status");

	const outboxEntry = await OutboxModel.findOne({ processId });
	if (!outboxEntry) {
		throw new NotFound(`Outbox entry not found: ${processId}`);
	}

	if (status === "completed") {
		// Use transaction to ensure atomicity
		const session = await mongoose.startSession();
		await session.withTransaction(async () => {
			// 1. Create new outbox entry with completed status
			await OutboxModel.markAsCompleted(outboxEntry, usage);

			// 2. Save parsed CV data (guaranteed to exist due to schema validation)
			const cvDataPayload = {
				uploadId: outboxEntry.uploadId,
				userId: outboxEntry.userId,
				...(data satisfies ParsedCVData),
			};
			
			log.info({ 
					processId,
				personal: cvDataPayload.personal,
				linksCount: cvDataPayload.links?.length,
				languagesCount: cvDataPayload.languages?.length,
				...(usage && {
					promptTokens: usage.promptTokens,
					completionTokens: usage.completionTokens,
					totalTokens: usage.totalTokens,
				}),
			}, "Saving CV data to database");
			
			await CVDataModel.createCVData(cvDataPayload);

			log.info(
				{ processId, uploadId: outboxEntry.uploadId },
				"Created completed outbox entry and saved CV data",
			);
		});
		await session.endSession();
	} else if (status === "failed") {
		await OutboxModel.markAsFailed(
			outboxEntry,
			error || "Processing failed",
			usage,
		);
		log.error({ 
			processId, 
			error,
			...(usage && {
				promptTokens: usage.promptTokens,
				completionTokens: usage.completionTokens,
				totalTokens: usage.totalTokens,
			}),
		}, "Created failed outbox entry");
	}

	return res.status(200).json({
		success: true,
		processId,
		status,
	});
}
