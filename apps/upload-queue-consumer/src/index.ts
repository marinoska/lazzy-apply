import type { ParseCVQueueMessage } from "@lazyapply/types";
import { instrument, type ResolveConfigFn } from "@microlabs/otel-cf-workers";
import { Logger } from "./lib/logger";
import { processMessage } from "./lib/messageProcessor";
import { handleQueueBatch } from "./lib/queueHandler";
import { handleUpload } from "./lib/uploadHandler";
import type { Env } from "./types";

// Re-export Env type for backward compatibility
export type { Env };

/**
 * Cloudflare Worker entry point
 * Handles file uploads (POST /upload) and queue message processing (parse-cv)
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

		// Upload endpoint - single entry point for all file uploads
		if (request.method === "POST" && url.pathname === "/upload") {
			return handleUpload(request, env);
		}

		// Local test endpoint for queue processing (dev only)
		if (
			env.ENVIRONMENT === "local" &&
			request.method === "POST" &&
			url.pathname === "/test-process"
		) {
			const payload = (await request.json()) as ParseCVQueueMessage;
			await processMessage(payload, env);
			return new Response("Processed test message\n", { status: 200 });
		}

		// Health check
		if (request.method === "GET" && url.pathname === "/health") {
			return new Response(JSON.stringify({ status: "ok" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
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
