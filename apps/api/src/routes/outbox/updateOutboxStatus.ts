import { NotFound } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { OutboxModel } from "@/outbox/outbox.model.js";
import type { Request, Response } from "express";
import { z } from "zod";

const log = createLogger("update-outbox-status");

export const updateOutboxParamsSchema = z.object({
	logId: z.string().min(1, "logId is required"),
});

export const updateOutboxBodySchema = z.object({
	status: z.enum(["completed", "failed"]),
	data: z.record(z.unknown()).nullable().optional(),
	error: z.string().optional(),
});

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
		await outboxEntry.markAsCompleted();
		log.info({ logId, data }, "Outbox entry marked as completed");
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
