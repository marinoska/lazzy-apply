import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { createLogger } from "@/app/logger.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";
import { OutboxEntryAlreadyProcessingError } from "@/domain/uploads/model/outbox.errors.js";
import { OutboxModel } from "@/domain/uploads/model/outbox.model.js";
import { sendToParseQueue } from "@/workers/queue/index.js";

const log = createLogger("finalizeUpload");

export const finalizeUploadRequestSchema = z.object({
	fileId: z.string().uuid(),
	processId: z.string().uuid(),
	size: z.number().int().positive(),
	rawText: z.string().min(1),
	fileHash: z.string().min(1),
});

type FinalizeUploadRequest = z.infer<typeof finalizeUploadRequestSchema>;

type FinalizeUploadResponse =
	| {
			fileId: string;
			processId: string;
			existingFileId?: string;
	  }
	| {
			error: string;
	  };

/**
 * Finalize upload - Phase 2 of 2-phase upload flow
 * Validates limits, updates DB, and triggers queue atomically
 * Worker calls this after storing file in R2
 */
export const finalizeUploadController = async (
	req: Request<unknown, FinalizeUploadResponse, FinalizeUploadRequest>,
	res: Response<FinalizeUploadResponse>,
) => {
	const { fileId, processId, size, rawText, fileHash } = req.body;

	log.info(
		{ fileId, size, rawTextLength: rawText.length },
		"Finalizing upload",
	);

	// Find the pending upload record
	const pendingUpload = await FileUploadModel.findOne({
		fileId,
		status: "pending",
	}).setOptions({ skipOwnershipEnforcement: true });

	if (!pendingUpload) {
		log.warn({ fileId }, "Pending upload not found");
		return res.status(404).json({
			error: "Pending upload not found",
		});
	}

	// Start transaction for atomic canonical resolution + DB write + queue enqueue
	// This prevents race conditions between checking canonical status and claiming it
	const session = await mongoose.startSession();
	session.startTransaction();

	try {
		// Resolve canonical status atomically within transaction
		const resolution = await FileUploadModel.resolveAndClaimCanonical(
			{
				fileHash,
				excludeFileId: fileId,
				userId: pendingUpload.userId,
			},
			session,
		);

		if (resolution.action === "deduplicate") {
			const canonicalUpload = resolution.canonicalUpload;
			log.info(
				{ fileId, canonicalFileId: canonicalUpload.fileId },
				"File deduplicated against canonical",
			);

			// Mark as deduplicated (non-canonical) within transaction
			pendingUpload.status = "deduplicated";
			pendingUpload.deduplicatedFrom = canonicalUpload._id;
			pendingUpload.size = size;
			pendingUpload.rawTextSize = new TextEncoder().encode(rawText).length;
			pendingUpload.rawText = rawText;
			pendingUpload.fileHash = fileHash;
			// isCanonical remains false (default)
			await pendingUpload.save({ session });

			await session.commitTransaction();

			return res.status(200).json({
				existingFileId: canonicalUpload.fileId,
				fileId,
				processId,
			});
		}

		// action === "become_canonical" - previous canonical already revoked in resolveAndClaimCanonical

		// Update upload record to "uploaded" status and mark as canonical
		pendingUpload.status = "uploaded";
		pendingUpload.size = size;
		pendingUpload.rawTextSize = new TextEncoder().encode(rawText).length;
		pendingUpload.fileHash = fileHash;
		pendingUpload.rawText = rawText;
		pendingUpload.isCanonical = true;
		await pendingUpload.save({ session });

		// Create outbox entry for queue processing
		await OutboxModel.create(
			[
				{
					processId,
					type: "file_upload",
					status: "pending",
					uploadId: pendingUpload._id,
					fileId,
					userId: pendingUpload.userId,
					fileType: pendingUpload.contentType,
				},
			],
			{ session },
		);

		// Commit transaction before sending to queue
		await session.commitTransaction();

		log.info({ fileId, processId }, "Upload finalized, triggering queue");

		// Send to parse queue (outside transaction - if this fails, outbox worker will retry)
		// The sendToParseQueue function uses atomic locking (pending → sending → processing)
		try {
			await sendToParseQueue(
				{
					uploadId: pendingUpload._id.toString(),
					fileId,
					processId,
					userId: pendingUpload.userId,
					fileType: pendingUpload.contentType,
				},
				{ idempotencyKey: processId },
			);
		} catch (error) {
			// Log but don't fail - outbox worker will retry
			if (!(error instanceof OutboxEntryAlreadyProcessingError)) {
				log.error(
					{ fileId, processId, error },
					"Failed to send to parse queue",
				);
			}
		}

		return res.status(200).json({
			fileId,
			processId,
		});
	} catch (error) {
		await session.abortTransaction();
		throw error;
	} finally {
		session.endSession();
	}
};
