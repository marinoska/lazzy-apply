import type { ParseCVQueueMessage } from "@lazyapply/types";
import { instrument, type ResolveConfigFn } from "@microlabs/otel-cf-workers";
import type { Env } from "./types";
import { Logger } from "./lib/logger";
import { processMessage } from "./lib/messageProcessor";
import { handleQueueBatch } from "./lib/queueHandler";

// Re-export Env type for backward compatibility
export type { Env };

/**
 * Queue consumer handler
 * This function is invoked when messages are delivered from the parse-cv queue
 */
const handler = {
	async fetch(request: Request, env: Env): Promise<Response> {
		const logger = new Logger(env);
		const url = new URL(request.url);
		logger.info("Worker fetch request", {
			environment: env.ENVIRONMENT,
			path: url.pathname,
			method: request.method,
		});
		
		// Local test endpoint
		if (request.method === "POST" && url.pathname === "/") {
			const payload = (await request.json()) as ParseCVQueueMessage;
			await processMessage(payload, env);
			return new Response("Processed test message\n", { status: 200 });
		}

		return new Response("upload-queue-consumer OK\n", { status: 200 });
	},
	async queue(
		batch: MessageBatch<ParseCVQueueMessage>,
		env: Env,
		ctx: ExecutionContext,
	): Promise<void> {
		await handleQueueBatch(batch, env, ctx);
	},
};

/**
 * OpenTelemetry configuration for Axiom
 * Note: In local development, OTEL export errors are expected and can be ignored
 */
const config: ResolveConfigFn = (env: Env, _trigger) => {
	return {
		exporter: {
			url: "https://api.axiom.co/v1/traces",
			headers: {
				Authorization: `Bearer ${env.AXIOM_API_TOKEN || ""}`,
				"X-Axiom-Dataset": env.AXIOM_OTEL_DATASET || "default",
			},
		},
		service: {
			name: "upload-queue-consumer",
		},
		resourceAttributes: {
			environment: env.ENVIRONMENT,
		},
	};
};

export default instrument(handler, config);
