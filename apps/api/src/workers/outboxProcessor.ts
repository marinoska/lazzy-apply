import { createLogger } from "@/app/logger.js";
import { OutboxEntryAlreadyProcessingError } from "@/outbox/outbox.errors.js";
import { OutboxModel } from "@/outbox/outbox.model.js";
import { sendToParseQueue } from "@/workers/queue/index.js";

const log = createLogger("outbox-processor");

const SCAN_INTERVAL_MS = 5_000; // Check every 5 seconds
const BATCH_LIMIT = 10;

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Processes pending outbox entries by sending them to the appropriate queue
 * This runs periodically to handle async queue processing
 */
const processOutboxEntries = async () => {
	if (isRunning) {
		log.warn("Previous scan still running, skipping this cycle");
		return;
	}

	isRunning = true;

	try {
		log.debug("Scanning for pending outbox entries");

		// Find pending outbox entries
		const pendingEntries = await OutboxModel.findPendingLogs(BATCH_LIMIT);

		if (pendingEntries.length > 0) {
			log.info(
				{ count: pendingEntries.length },
				"Processing pending outbox entries",
			);
		} else {
			log.debug("No pending outbox entries found");
		}

		for (const entry of pendingEntries) {
			try {
				// Process based on type
				if (entry.type === "file_upload") {
					await sendToParseQueue(
						{
							uploadId: entry.uploadId,
							fileId: entry.fileId,
							processId: entry.processId,
							userId: entry.userId,
							fileType: entry.fileType,
						},
						{ idempotencyKey: entry.processId },
					);

					log.info(
						{ fileId: entry.fileId, processId: entry.processId },
						"Successfully sent file to parse queue",
					);
				} else {
					log.warn(
						{ type: entry.type, processId: entry.processId },
						"Unknown outbox entry type",
					);
					await OutboxModel.markAsFailed(
						entry,
						`Unknown outbox type: ${entry.type}`,
					);
				}
			} catch (error) {
				// If entry was already locked/processing, skip without marking as failed
				if (error instanceof OutboxEntryAlreadyProcessingError) {
					log.debug(
						{ processId: entry.processId, fileId: entry.fileId },
						"Outbox entry already being processed, skipping",
					);
					continue;
				}

				const errorMessage =
					error instanceof Error ? error.message : String(error);

				log.error(
					{
						error: errorMessage,
						processId: entry.processId,
						fileId: entry.fileId,
						type: entry.type,
					},
					"Failed to process outbox entry",
				);

				// Create failed entry in outbox
				await OutboxModel.markAsFailed(entry, errorMessage);
			}
		}
	} catch (error) {
		log.error(
			{
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
			"Error in processOutboxEntries",
		);
	} finally {
		isRunning = false;
	}
};

export const startOutboxProcessor = () => {
	if (intervalHandle) {
		log.warn("Outbox processor already running, skipping start");
		return;
	}

	log.info(
		{ scanIntervalMs: SCAN_INTERVAL_MS, batchLimit: BATCH_LIMIT },
		"Starting outbox processor",
	);

	void processOutboxEntries();

	intervalHandle = setInterval(() => {
		log.debug("Running scheduled outbox scan");
		void processOutboxEntries();
	}, SCAN_INTERVAL_MS);

	log.info("Outbox processor started successfully");
};

export const stopOutboxProcessor = () => {
	if (!intervalHandle) {
		return;
	}

	clearInterval(intervalHandle);
	intervalHandle = null;
	log.info("Outbox processor stopped");
};
