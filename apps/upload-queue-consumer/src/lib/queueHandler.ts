import type { ParseCVQueueMessage } from "@lazyapply/types";
import type { Env } from "../types";
import { Logger } from "./logger";
import { processMessage } from "./messageProcessor";

const MAX_RETRIES = 3;

/**
 * Handle a batch of queue messages with retry logic
 */
export async function handleQueueBatch(
	batch: MessageBatch<ParseCVQueueMessage>,
	env: Env,
	ctx: ExecutionContext,
): Promise<void> {
	const logger = new Logger(env);
	logger.info("Processing queue batch", {
		batchSize: batch.messages.length,
		environment: env.ENVIRONMENT,
		logIds: batch.messages.map(m => m.body.logId).join(", "),
		operation: "queue_batch",
	});

	const results = await Promise.allSettled(
		batch.messages.map((message) => processMessage(message.body, env)),
	);

	results.forEach((result, index) => {
		const message = batch.messages[index];
		
		if (result.status === "rejected") {
			handleFailedMessage(message, result.reason, env, ctx, logger);
		} else {
			handleSuccessfulMessage(message, index, logger);
		}
	});
}

function handleFailedMessage(
	message: Message<ParseCVQueueMessage>,
	error: unknown,
	env: Env,
	ctx: ExecutionContext,
	logger: Logger,
): void {
	const { logId } = message.body;
	const attempts = message.attempts;

	logger.error(
		"Queue message processing failed",
		{
			logId,
			attempts,
			operation: "queue_message",
		},
		error instanceof Error ? error : new Error(String(error)),
	);

	if (attempts < MAX_RETRIES) {
		logger.info("Retrying queue message", { logId, attempts, operation: "queue_retry" });
		message.retry();
	} else {
		logger.error("Message exceeded max retries, sending to DLQ", {
			logId,
			attempts,
			maxRetries: MAX_RETRIES,
			operation: "queue_dlq",
		});
		ctx.waitUntil(env.PARSE_CV_DLQ.send(message.body));
	}
}

function handleSuccessfulMessage(
	message: Message<ParseCVQueueMessage>,
	index: number,
	logger: Logger,
): void {
	logger.info("Queue message processed successfully", {
		logId: message.body.logId,
		batchIndex: index,
		operation: "queue_message",
	});
}
