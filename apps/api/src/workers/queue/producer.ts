import {
	CF_QUEUE_MESSAGE_ID_HEADER,
	type ParseCVQueueMessage,
} from "@lazyapply/types";
import { getEnv } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import { OutboxEntryAlreadyProcessingError } from "@/outbox/outbox.errors.js";
import { OutboxModel } from "@/outbox/outbox.model.js";

const log = createLogger("queue-producer");

type SendToParseQueueOptions = {
	/** Optional idempotency key for queue message deduplication */
	idempotencyKey?: string;
};

/**
 * Send a message to the Cloudflare parse-cv queue using atomic Outbox pattern.
 *
 * Flow (event-sourcing - each status change creates a new document):
 * 1. Find pending entry and create new "sending" entry
 * 2. Send message to Cloudflare Queue
 * 3. Create new "processing" entry
 *
 * If queue send fails, the entry stays in "sending" state and can be retried
 * by a cleanup job that creates a new "pending" entry.
 */
export async function sendToParseQueue(
	message: ParseCVQueueMessage,
	options: SendToParseQueueOptions = {},
): Promise<void> {
	const { processId, fileId } = message;

	log.debug({ processId, fileId }, "Attempting to send message to queue");

	// Step 1: Find pending entry and create new "sending" entry (event-sourcing)
	const sendingEntry = await OutboxModel.markAsSending(processId);

	if (!sendingEntry) {
		log.error(
			{ processId, fileId },
			"Outbox entry not found or already locked/processed - aborting",
		);
		throw new OutboxEntryAlreadyProcessingError(processId);
	}

	log.debug(
		{ processId, fileId, status: sendingEntry.status },
		"Created sending entry for outbox",
	);

	// Step 2: Send message to Cloudflare Queue
	// If this fails, the entry stays in "sending" state (can be retried by cleanup job)
	try {
		await sendToCloudflareQueue(message, options);
	} catch (error) {
		log.error(
			{ processId, fileId, error },
			"Failed to send to Cloudflare Queue - entry remains in sending state",
		);
		throw error;
	}

	// Step 3: Create new "processing" entry (event-sourcing)
	await OutboxModel.markAsProcessing(sendingEntry);

	log.info(
		{ processId, fileId },
		"Message sent to queue and processing entry created",
	);
}

/**
 * Send message to Cloudflare Queue API
 */
async function sendToCloudflareQueue(
	message: ParseCVQueueMessage,
	options: SendToParseQueueOptions,
): Promise<void> {
	const accountId = getEnv("CLOUDFLARE_ACCOUNT_ID");
	const queueId = getEnv("CLOUDFLARE_QUEUE_ID");
	const apiToken = getEnv("CLOUDFLARE_QUEUE_TOKEN");
	const { processId, fileId } = message;

	log.debug(
		{ processId, fileId, queueId },
		"Sending message to Cloudflare Queue",
	);

	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/queues/${queueId}/messages`;

	// Build request body with optional idempotency key
	const requestBody: {
		body: ParseCVQueueMessage;
		content_type?: string;
		delay_seconds?: number;
	} = {
		body: message,
	};

	// Add idempotency key as part of the message if provided
	// Cloudflare Queues uses message content for deduplication within the deduplication window
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${apiToken}`,
	};

	if (options.idempotencyKey) {
		headers[CF_QUEUE_MESSAGE_ID_HEADER] = options.idempotencyKey;
		log.debug(
			{ processId, idempotencyKey: options.idempotencyKey },
			"Using idempotency key",
		);
	}

	const response = await fetch(url, {
		method: "POST",
		headers,
		body: JSON.stringify(requestBody),
	});

	if (!response.ok) {
		const errorText = await response.text();
		log.error(
			{ processId, fileId, status: response.status, error: errorText },
			"Failed to send message to Cloudflare Queue",
		);
		throw new Error(
			`Failed to send message to parse-cv queue: ${response.status} ${errorText}`,
		);
	}

	const result = (await response.json()) as {
		success: boolean;
		errors?: unknown[];
	};

	if (!result.success) {
		log.error(
			{ processId, fileId, errors: result.errors },
			"Cloudflare Queue API returned success=false",
		);
		throw new Error(
			`Cloudflare Queue API returned success=false: ${JSON.stringify(result.errors)}`,
		);
	}

	log.info(
		{ processId, fileId },
		"Message sent to Cloudflare Queue successfully",
	);
}
