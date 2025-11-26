import { getEnv } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import type { OutboxDocument } from "@/outbox/outbox.types.js";
import type { ParseCVQueueMessage } from "@lazyapply/types";

const log = createLogger("queue-producer");

/**
 * Send a message to the Cloudflare parse-cv queue
 * On success, marks the outbox entry as processing
 */
export async function sendToParseQueue(
	message: ParseCVQueueMessage,
	outboxDoc: OutboxDocument,
): Promise<void> {
	const accountId = getEnv("CLOUDFLARE_ACCOUNT_ID");
	const queueId = getEnv("CLOUDFLARE_QUEUE_ID");
	const apiToken = getEnv("CLOUDFLARE_QUEUE_TOKEN");

	log.debug(
		{ logId: message.logId, fileId: message.fileId, queueId },
		"Sending message to Cloudflare Queue",
	);

	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/queues/${queueId}/messages`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiToken}`,
		},
		body: JSON.stringify({
			body: message,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		log.error(
			{
				logId: message.logId,
				fileId: message.fileId,
				status: response.status,
				error: errorText,
			},
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
			{
				logId: message.logId,
				fileId: message.fileId,
				errors: result.errors,
			},
			"Cloudflare Queue API returned success=false",
		);
		throw new Error(
			`Cloudflare Queue API returned success=false: ${JSON.stringify(result.errors)}`,
		);
	}

	log.info(
		{ logId: message.logId, fileId: message.fileId },
		"Message sent to Cloudflare Queue successfully",
	);

	// Mark outbox as processing after successful queue push
	await outboxDoc.markAsProcessing();

	log.debug(
		{ logId: message.logId, fileId: message.fileId },
		"Outbox entry marked as processing",
	);
}
