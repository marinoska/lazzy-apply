import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { getCloudflareClient } from "@/app/cloudflare.js";
import { createLogger } from "@/app/logger.js";
import { UPLOAD_TIMEOUT_SECONDS } from "@/routes/uploads/constants.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";

const log = createLogger("pending-upload-monitor");

const SCAN_INTERVAL_MS = 60_000; // Check every minute
const BATCH_LIMIT = 20;

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Processes stale pending uploads by marking them as failed and cleaning up quarantine
 * This runs periodically to handle abandoned uploads that never completed
 */
const processPendingUploads = async () => {
	if (isRunning) {
		return;
	}

	isRunning = true;

	try {
		// Calculate cutoff time: uploads older than UPLOAD_TIMEOUT_SECONDS are considered abandoned
		const cutoffTime = new Date(Date.now() - UPLOAD_TIMEOUT_SECONDS * 1000);

		// Find pending uploads that have exceeded the timeout
		// Bypass ownership enforcement for system-level background job
		const stalePendingUploads = await FileUploadModel.find({
			status: "pending",
			createdAt: { $lt: cutoffTime },
		})
			.setOptions({ skipOwnershipEnforcement: true })
			.sort({ createdAt: 1 })
			.limit(BATCH_LIMIT)
			.exec();

		if (stalePendingUploads.length > 0) {
			log.info(
				{ count: stalePendingUploads.length },
				"Processing stale pending uploads",
			);
		}

		for (const fileUpload of stalePendingUploads) {
			try {
				// Mark as failed in database first
				await FileUploadModel.findOneAndUpdate(
					{ fileId: fileUpload.fileId },
					{ $set: { status: "failed" } },
				).setOptions({ userId: fileUpload.userId });

				// Then delete from quarantine if it exists
				// File might not exist if upload never started or already failed
				try {
					const deleteCommand = new DeleteObjectCommand({
						Bucket: fileUpload.bucket,
						Key: fileUpload.objectKey,
					});

					await getCloudflareClient().send(deleteCommand);

					log.info(
						{ fileId: fileUpload.fileId, objectKey: fileUpload.objectKey },
						"Deleted stale file from quarantine",
					);
				} catch (deleteError) {
					// File might not exist in R2, which is fine
					log.debug(
						{ deleteError, fileId: fileUpload.fileId },
						"Could not delete file from quarantine (may not exist)",
					);
				}
			} catch (error) {
				log.error(
					{ error, fileId: fileUpload.fileId, userId: fileUpload.userId },
					"Failed to process stale pending upload",
				);
			}
		}
	} catch (error) {
		log.error({ error }, "Error in processPendingUploads");
	} finally {
		isRunning = false;
	}
};

export const startPendingUploadMonitor = () => {
	if (intervalHandle) {
		return;
	}

	void processPendingUploads();

	intervalHandle = setInterval(() => {
		void processPendingUploads();
	}, SCAN_INTERVAL_MS);
};

export const stopPendingUploadMonitor = () => {
	if (!intervalHandle) {
		return;
	}

	clearInterval(intervalHandle);
	intervalHandle = null;
};
