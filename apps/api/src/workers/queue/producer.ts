import { getEnv } from "@/app/env.js";
import type { OutboxDocument } from "@/outbox/outbox.types.js";

export type ParseCVQueueMessage = {
	fileId: string;
	logId: string;
	userId: string;
};

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
		throw new Error(
			`Failed to send message to parse-cv queue: ${response.status} ${errorText}`,
		);
	}

	const result = (await response.json()) as {
		success: boolean;
		errors?: unknown[];
	};
	if (!result.success) {
		throw new Error(
			`Cloudflare Queue API returned success=false: ${JSON.stringify(result.errors)}`,
		);
	}

	// Mark outbox as processing after successful queue push
	await outboxDoc.markAsProcessing();
}
