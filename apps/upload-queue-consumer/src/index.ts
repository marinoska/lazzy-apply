import type {
	ParseCVQueueMessage,
	ParsedCVData,
	FileUploadContentType,
} from "@lazyapply/types";
import { MAXIMUM_UPLOAD_SIZE_BYTES } from "@lazyapply/types";
import { extractText } from "./lib/extractText";
import { extractCVData } from "./lib/extractCVData";

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

	ENVIRONMENT: "prod" | "dev";
};

/**
 * Queue consumer handler
 * This function is invoked when messages are delivered from the parse-cv queue
 */
export default {
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
		console.log(`Processing batch of ${batch.messages.length} messages`);

		const results = await Promise.allSettled(
			batch.messages.map((message) => processMessage(message.body, env)),
		);

		results.forEach((result, index) => {
			if (result.status === "rejected") {
				const message = batch.messages[index];
				const attempts = message.attempts;

				console.error(
					`Message ${index} failed (attempt ${attempts}):`,
					result.reason,
				);

				if (attempts < 3) {
					// Try again later
					message.retry();
				} else {
					console.error(
						`Message ${index} exceeded max retries, sending to DLQ`,
					);
					// Push to DLQ, but don't retry in main queue
					ctx.waitUntil(env.PARSE_CV_DLQ.send(message.body));
				}
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

	console.log(`Processing upload: ${uploadId}, file: ${fileId} for user: ${userId}, type: ${fileType}`);

	try {
		// 1. Download the CV file from R2
		const file = await downloadFile(env, fileId);
		if (!file) {
			throw new Error(`File not found in R2: ${fileId}`);
		}

		// 2. Validate file size
		if (file.byteLength > MAXIMUM_UPLOAD_SIZE_BYTES) {
			// Delete the file and fail
			await deleteFile(env, fileId);
			throw new Error(
				`File size (${file.byteLength} bytes) exceeds maximum allowed size (${MAXIMUM_UPLOAD_SIZE_BYTES} bytes)`,
			);
		}

		// 3. Parse the CV using AI extraction with fileType validation
		const parsedData = await parseCV(file, fileId, fileType, env);

		// 4. Update the outbox entry via API call
		await updateOutboxStatus(
			env,
			logId,
			"completed",
			parsedData,
		);

		// 5. Acknowledge the message (automatic if no error is thrown)
		console.log(`Successfully processed file: ${fileId}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error processing file ${fileId}:`, errorMessage);

		// Update outbox to failed status
		await updateOutboxStatus(env, logId, "failed", null, errorMessage);

		// Re-throw error so the queue handler can retry this specific message
		throw error;
	}
}

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
		const object = await env.UPLOADS_BUCKET.get(objectKey);
		if (!object) {
			return null;
		}
		return await object.arrayBuffer();
	} catch (error) {
		console.error(`Failed to download file ${fileId}:`, error);
		throw error;
	}
}

/**
 * Delete file from R2 bucket
 */
async function deleteFile(env: Env, fileId: string): Promise<void> {
	try {
		const objectKey = `${CV_DIRECTORY}/${fileId}`;
		await env.UPLOADS_BUCKET.delete(objectKey);
		console.log(`Deleted file: ${fileId}`);
	} catch (error) {
		console.error(`Failed to delete file ${fileId}:`, error);
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
	console.log(`Parsing CV file: ${fileId}, expected type: ${expectedFileType}`);

	// 1. Extract text from PDF or DOCX with type validation
	const cvText = await extractText(fileBuffer, expectedFileType);

	console.log(`Extracted ${cvText.length} characters from file`);

	// 2. Extract structured data using GPT-4o-mini
	const parsedData = await extractCVData(cvText, env.OPENAI_API_KEY);

	console.log(`Successfully extracted CV data for file: ${fileId}`);

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
