import type { ParsedCVData } from "@lazyapply/types";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { NotFound, ValidationError } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { OutboxModel } from "@/domain/uploads/model/outbox.model.js";

const log = createLogger("update-outbox-status");

export const updateOutboxParamsSchema = z.object({
	processId: z.string().min(1, "processId is required"),
});

export const updateOutboxBodySchema = z
	.object({
		status: z.enum(["completed", "failed", "not-a-cv"]),
		data: z.any().nullable().optional(), // ParsedCVData
		error: z.string().optional(),
		usage: z
			.object({
				promptTokens: z.number(),
				completionTokens: z.number(),
				totalTokens: z.number(),
				inputCost: z.number().optional(),
				outputCost: z.number().optional(),
				totalCost: z.number().optional(),
			})
			.optional(),
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
 *
 * Idempotency: If the latest outbox entry for this processId is already
 * completed/failed, we return success without reprocessing (duplicate delivery).
 */
export async function updateOutboxStatus(req: Request, res: Response) {
	const { processId } = req.params;
	const { status, data, error, usage } = req.body;

	log.info({ processId, status }, "Updating outbox status");

	// Find the latest outbox entry for this processId (sorted by createdAt desc)
	const outboxEntries = await OutboxModel.find({ processId })
		.sort({ createdAt: -1 })
		.limit(1);

	if (outboxEntries.length === 0) {
		throw new NotFound(`Outbox entry not found: ${processId}`);
	}

	const latestEntry = outboxEntries[0];

	// Idempotency check: if already in terminal state, return success
	// This handles duplicate message delivery from Cloudflare Queues
	if (
		latestEntry.status === "completed" ||
		latestEntry.status === "failed" ||
		latestEntry.status === "not-a-cv"
	) {
		log.warn(
			{ processId, currentStatus: latestEntry.status, requestedStatus: status },
			"Outbox entry already in terminal state - duplicate delivery detected",
		);
		return res.status(200).json({
			processId,
			status: latestEntry.status,
			duplicate: true,
		});
	}

	// Verify entry is in expected state (processing or sending)
	if (latestEntry.status !== "processing" && latestEntry.status !== "sending") {
		log.warn(
			{ processId, currentStatus: latestEntry.status, requestedStatus: status },
			"Outbox entry in unexpected state",
		);
		throw new ValidationError(
			`Cannot update outbox entry in state '${latestEntry.status}' to '${status}'`,
		);
	}

	if (status === "completed") {
		// Use transaction to ensure atomicity
		const session = await mongoose.startSession();
		await session.withTransaction(async () => {
			// 1. Create new outbox entry with completed status
			await OutboxModel.markAsCompleted(latestEntry, usage);

			// 2. Save parsed CV data (guaranteed to exist due to schema validation)
			const cvDataPayload = {
				uploadId: latestEntry.uploadId,
				userId: latestEntry.userId,
				...(data satisfies ParsedCVData),
			};

			log.info(
				{
					processId,
					personal: cvDataPayload.personal,
					linksCount: cvDataPayload.links?.length,
					languagesCount: cvDataPayload.languages?.length,
					...(usage && {
						promptTokens: usage.promptTokens,
						completionTokens: usage.completionTokens,
						totalTokens: usage.totalTokens,
						inputCost: usage.inputCost,
						outputCost: usage.outputCost,
						totalCost: usage.totalCost,
					}),
				},
				"Saving CV data to database",
			);

			await CVDataModel.createCVData(cvDataPayload);

			log.info(
				{
					processId,
					uploadId: latestEntry.uploadId,
					...(usage && {
						promptTokens: usage.promptTokens,
						completionTokens: usage.completionTokens,
						totalTokens: usage.totalTokens,
						inputCost: usage.inputCost,
						outputCost: usage.outputCost,
						totalCost: usage.totalCost,
					}),
				},
				"Created completed outbox entry and saved CV data",
			);
		});
		await session.endSession();
	} else if (status === "failed") {
		await OutboxModel.markAsFailed(
			latestEntry,
			error || "Processing failed",
			usage,
		);
		log.error(
			{
				processId,
				error,
				...(usage && {
					promptTokens: usage.promptTokens,
					completionTokens: usage.completionTokens,
					totalTokens: usage.totalTokens,
					inputCost: usage.inputCost,
					outputCost: usage.outputCost,
					totalCost: usage.totalCost,
				}),
			},
			"Created failed outbox entry",
		);
	} else if (status === "not-a-cv") {
		await OutboxModel.markAsNotACV(latestEntry, usage);
		log.warn(
			{
				processId,
				...(usage && {
					promptTokens: usage.promptTokens,
					completionTokens: usage.completionTokens,
					totalTokens: usage.totalTokens,
					inputCost: usage.inputCost,
					outputCost: usage.outputCost,
					totalCost: usage.totalCost,
				}),
			},
			"File is not a CV - created not-a-cv outbox entry",
		);
	}

	return res.status(200).json({
		processId,
		status,
	});
}
