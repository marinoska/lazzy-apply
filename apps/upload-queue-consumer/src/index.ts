import type {
	ParseCVQueueMessage,
	ParsedCVData,
	FileUploadContentType,
} from "@lazyapply/types";
import { MAXIMUM_UPLOAD_SIZE_BYTES } from "@lazyapply/types";
import { extractText } from "./lib/extractText";
import { extractCVData } from "./lib/extractCVData";
import { trace, context } from "@opentelemetry/api";
import { instrument, type ResolveConfigFn } from "@microlabs/otel-cf-workers";
import { Logger } from "./lib/logger";

const CV_DIRECTORY = "cv";

export type Env = {
	// R2 Bucket binding
	UPLOADS_BUCKET: R2Bucket;

	// Queue binding for Dead Letter Queue
	PARSE_CV_DLQ: Queue<ParseCVQueueMessage>;

	// API base URL for callbacks
	API_URL: string;

	// Worker authentication secret
	WORKER_SECRET: string;

	// OpenAI API Key for CV extraction
	OPENAI_API_KEY: string;

	ENVIRONMENT: "prod" | "dev" | "local";

	// Axiom OpenTelemetry configuration
	AXIOM_API_TOKEN: string;
	AXIOM_OTEL_DATASET: string;

	// Axiom Logs dataset
	AXIOM_LOGS_DATASET: string;
};

/**
 * Queue consumer handler
 * This function is invoked when messages are delivered from the parse-cv queue
 */
const handler = {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		console.log("ENVIRONMENT:", env.ENVIRONMENT);
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
		console.log(`[QUEUE] Processing batch of ${batch.messages.length} messages in ${env.ENVIRONMENT} environment`);
		console.log(`[QUEUE] Batch message IDs:`, batch.messages.map(m => m.body.logId));

		const results = await Promise.allSettled(
			batch.messages.map((message) => processMessage(message.body, env)),
		);

		results.forEach((result, index) => {
			if (result.status === "rejected") {
				const message = batch.messages[index];
				const attempts = message.attempts;

				console.error(
					`[QUEUE] Message ${index} (logId: ${message.body.logId}) failed (attempt ${attempts}):`,
					result.reason,
				);

				if (attempts < 3) {
					// Try again later
					console.log(`[QUEUE] Retrying message ${index} (logId: ${message.body.logId})`);
					message.retry();
				} else {
					console.error(
						`[QUEUE] Message ${index} (logId: ${message.body.logId}) exceeded max retries, sending to DLQ`,
					);
					// Push to DLQ, but don't retry in main queue
					ctx.waitUntil(env.PARSE_CV_DLQ.send(message.body));
				}
			} else {
				console.log(`[QUEUE] Message ${index} (logId: ${batch.messages[index].body.logId}) processed successfully`);
			}
		});
	},
};

/**
 * Process a single message from the queue
 */
async function processMessage(
	payload: ParseCVQueueMessage,
	env: Env,
): Promise<void> {
	const { uploadId, fileId, logId, userId, fileType } = payload;
	const logger = new Logger(env);
	const logContext = { uploadId, fileId, logId, userId, fileType };

	await logger.info("Starting message processing", logContext);

	const tracer = trace.getTracer("upload-queue-consumer");
	const span = tracer.startSpan("processMessage");
	span.setAttribute("uploadId", uploadId);
	span.setAttribute("fileId", fileId);
	span.setAttribute("logId", logId);
	span.setAttribute("userId", userId);
	span.setAttribute("fileType", fileType);

	const startTime = Date.now();

	try {
		// 1. Download the CV file from R2
		await logger.info("Downloading file from R2", { ...logContext, operation: "download" });
		const downloadSpan = tracer.startSpan("downloadFile", {}, context.active().setValue(Symbol.for("OpenTelemetry Context Key SPAN"), span));
		const file = await downloadFile(env, fileId);
		if (!file) {
			downloadSpan.recordException(new Error(`File not found in R2: ${fileId}`));
			downloadSpan.end();
			await logger.error("File not found in R2", logContext);
			throw new Error(`File not found in R2: ${fileId}`);
		}
		downloadSpan.setAttribute("fileSize", file.byteLength);
		downloadSpan.end();
		await logger.info("File downloaded successfully", { ...logContext, fileSize: file.byteLength, operation: "download" });

		// 2. Validate file size
		if (file.byteLength > MAXIMUM_UPLOAD_SIZE_BYTES) {
			// Delete the file and fail
			await logger.warn("File size exceeds limit, deleting file", { 
				...logContext, 
				fileSize: file.byteLength, 
				maxSize: MAXIMUM_UPLOAD_SIZE_BYTES,
				operation: "validate"
			});
			await deleteFile(env, fileId);
			throw new Error(
				`File size (${file.byteLength} bytes) exceeds maximum allowed size (${MAXIMUM_UPLOAD_SIZE_BYTES} bytes)`,
			);
		}

		// 3. Parse the CV using AI extraction with fileType validation
		await logger.info("Starting CV parsing", { ...logContext, operation: "parse" });
		const parseStart = Date.now();
		const parseSpan = tracer.startSpan("parseCV", {}, context.active().setValue(Symbol.for("OpenTelemetry Context Key SPAN"), span));
		parseSpan.setAttribute("fileId", fileId);
		parseSpan.setAttribute("fileType", fileType);
		const parsedData = await parseCV(file, fileId, fileType, env);
		parseSpan.end();
		const parseDuration = Date.now() - parseStart;
		await logger.info("CV parsing completed", { ...logContext, operation: "parse", duration: parseDuration });

		// 4. Update the outbox entry via API call
		const updateSpan = tracer.startSpan("updateOutboxStatus", {}, context.active().setValue(Symbol.for("OpenTelemetry Context Key SPAN"), span));
		updateSpan.setAttribute("logId", logId);
		updateSpan.setAttribute("status", "completed");
		await updateOutboxStatus(
			env,
			logId,
			"completed",
			parsedData,
		);
		updateSpan.end();

		// 5. Acknowledge the message (automatic if no error is thrown)
		const totalDuration = Date.now() - startTime;
		await logger.info("Successfully processed message", { 
			...logContext, 
			operation: "complete",
			duration: totalDuration,
			status: "success"
		});
		span.setStatus({ code: 1 }); // OK status
		span.end();
		await logger.flush();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const totalDuration = Date.now() - startTime;

		await logger.error(
			"Error processing message",
			{ 
				...logContext, 
				operation: "complete",
				duration: totalDuration,
				status: "failed"
			},
			error instanceof Error ? error : new Error(String(error))
		);

		// Update outbox to failed status
		await updateOutboxStatus(env, logId, "failed", null, errorMessage);

		// Record error in span
		span.recordException(error instanceof Error ? error : new Error(String(error)));
		span.setStatus({ code: 2, message: errorMessage }); // ERROR status
		span.end();
		await logger.flush();

		// Re-throw error so the queue handler can retry this specific message
		throw error;
	}
}

/**
 * OpenTelemetry configuration for Axiom
 */
const config: ResolveConfigFn = (env: Env, _trigger) => {
	return {
		exporter: {
			url: "https://api.axiom.co/v1/traces",
			headers: {
				Authorization: `Bearer ${env.AXIOM_API_TOKEN}`,
				"X-Axiom-Dataset": env.AXIOM_OTEL_DATASET,
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

/**
 * Download file from R2 bucket
 */
async function downloadFile(
	env: Env,
	fileId: string,
): Promise<ArrayBuffer | null> {
	try {
		// Files are stored in the CV directory after being promoted from quarantine
		const objectKey = `${CV_DIRECTORY}/${fileId}`;
		console.log(`[R2] Attempting to download from bucket: ${env.UPLOADS_BUCKET}, key: ${objectKey}`);
		const object = await env.UPLOADS_BUCKET.get(objectKey);
		if (!object) {
			console.error(`[R2] Object not found at key: ${objectKey}`);
			return null;
		}
		console.log(`[R2] Object found, downloading...`);
		return await object.arrayBuffer();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[R2] Failed to download file ${fileId}:`, errorMessage);
		throw error;
	}
}

/**
 * Delete file from R2 bucket
 */
async function deleteFile(env: Env, fileId: string): Promise<void> {
	try {
		const objectKey = `${CV_DIRECTORY}/${fileId}`;
		console.log(`[R2] Deleting file at key: ${objectKey}`);
		await env.UPLOADS_BUCKET.delete(objectKey);
		console.log(`[R2] Deleted file: ${fileId}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[R2] Failed to delete file ${fileId}:`, errorMessage);
		throw error;
	}
}

/**
 * Parse CV file using AI extraction
 */
async function parseCV(
	fileBuffer: ArrayBuffer,
	fileId: string,
	expectedFileType: FileUploadContentType,
	env: Env,
): Promise<ParsedCVData> {
	console.log(`[PARSE] Parsing CV file: ${fileId}, expected type: ${expectedFileType}`);

	// 1. Extract text from PDF or DOCX with type validation
	console.log(`[PARSE] Extracting text from ${expectedFileType}...`);
	const cvText = await extractText(fileBuffer, expectedFileType);

	console.log(`[PARSE] Extracted ${cvText.length} characters from file`);

	// 2. Extract structured data using GPT-4o-mini
	console.log(`[PARSE] Calling OpenAI API to extract structured data...`);
	const parsedData = await extractCVData(cvText, env.OPENAI_API_KEY);

	console.log(`[PARSE] Successfully extracted CV data for file: ${fileId}`);

	return parsedData;
}

/**
 * Update outbox entry status via API
 */
async function updateOutboxStatus(
	env: Env,
	logId: string,
	status: "completed" | "failed",
	data: ParsedCVData | null,
	error?: string,
): Promise<void> {
	try {
		console.log(`[updateOutboxStatus] API_URL: ${env.API_URL}`);
		console.log(
			`[updateOutboxStatus] WORKER_SECRET present: ${env.WORKER_SECRET ? "yes" : "no"}`,
		);

		const response = await fetch(`${env.API_URL}/api/outbox/${logId}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				"X-Worker-Secret": env.WORKER_SECRET,
			},
			body: JSON.stringify({
				status,
				data,
				error,
			}),
		});

		console.log(`[updateOutboxStatus] Response status: ${response.status}`);

		if (!response.ok) {
			throw new Error(
				`Failed to update outbox status: ${response.status} ${await response.text()}`,
			);
		}

		console.log(`Updated outbox ${logId} to status: ${status}`);
	} catch (error) {
		console.error(`Failed to update outbox ${logId}:`, error);
		// Don't throw - we don't want to retry the message if API update fails
		// The file has been processed, just log the error
	}
}
