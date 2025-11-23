import { DeleteObjectCommand } from "@aws-sdk/client-s3";

import { getCloudflareClient } from "@/app/cloudflare.js";
import { createLogger } from "@/app/logger.js";
import { UPLOAD_TIMEOUT_SECONDS } from "@/routes/uploads/constants.js";
import {
	type FileUploadDocument,
	FileUploadModel,
} from "@/uploads/fileUpload.model.js";

const log = createLogger("pending-upload-monitor");

const SCAN_INTERVAL_MS = 30_000; // Check every 30 seconds
const BATCH_LIMIT = 20;

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Processes a single stale file upload by marking it as failed and cleaning up from quarantine
 */
const processStaleFileUpload = async (
	fileUpload: FileUploadDocument,
): Promise<void> => {
	try {
		await fileUpload.markAsFailed();

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
			{
				error: error instanceof Error ? error.message : String(error),
				fileId: fileUpload.fileId,
				userId: fileUpload.userId,
			},
			"Failed to process stale pending upload",
		);
	}
};

/**
 * Processes stale pending uploads by marking them as failed and cleaning up quarantine
 * This runs periodically to handle abandoned uploads that never completed
 */
const processPendingUploads = async () => {
	if (isRunning) {
		log.warn("Previous scan still running, skipping this cycle");
		return;
	}

	isRunning = true;

	try {
		// Calculate cutoff time: uploads older than UPLOAD_TIMEOUT_SECONDS are considered abandoned
		const cutoffTime = new Date(Date.now() - UPLOAD_TIMEOUT_SECONDS * 1000);

		log.debug(
			{ cutoffTime: cutoffTime.toISOString() },
			"Scanning for stale pending uploads",
		);

		// Find pending uploads that have exceeded the timeout
		// Bypass ownership enforcement for system-level background job
		const stalePendingUploads = await FileUploadModel.findStalePendingUploads(
			cutoffTime,
			BATCH_LIMIT,
		);

		if (stalePendingUploads.length > 0) {
			log.info(
				{ count: stalePendingUploads.length },
				"Processing stale pending uploads",
			);
		} else {
			log.debug("No stale pending uploads found");
			return;
		}

		// Process all stale uploads in parallel for better throughput
		await Promise.all(stalePendingUploads.map(processStaleFileUpload));
	} catch (error) {
		log.error(
			{
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
			"Error in processPendingUploads",
		);
	} finally {
		isRunning = false;
	}
};

export const startPendingUploadMonitor = () => {
	if (intervalHandle) {
		log.warn("Pending upload monitor already running, skipping start");
		return;
	}

	log.info(
		{ scanIntervalMs: SCAN_INTERVAL_MS, batchLimit: BATCH_LIMIT },
		"Starting pending upload monitor",
	);

	void processPendingUploads();

	intervalHandle = setInterval(() => {
		log.debug("Running scheduled pending upload scan");
		void processPendingUploads();
	}, SCAN_INTERVAL_MS);

	log.info("Pending upload monitor started successfully");
};

export const stopPendingUploadMonitor = () => {
	if (!intervalHandle) {
		return;
	}

	clearInterval(intervalHandle);
	intervalHandle = null;
};
