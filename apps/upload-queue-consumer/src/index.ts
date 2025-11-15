import type { ParseCVQueueMessage, ParsedCVData } from "@lazyapply/types";

export type Env = {
	// R2 Bucket binding
	UPLOADS_BUCKET: R2Bucket;

	// Queue binding for Dead Letter Queue
	PARSE_CV_DLQ: Queue<ParseCVQueueMessage>;

	// API base URL for callbacks
	API_URL: string;
};

/**
 * Queue consumer handler
 * This function is invoked when messages are delivered from the parse-cv queue
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

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
	const { fileId, logId, userId } = payload;

	console.log(`Processing file: ${fileId} for user: ${userId}`);

	try {
		// 1. Download the CV file from R2
		const file = await downloadFile(env, fileId);
		if (!file) {
			throw new Error(`File not found in R2: ${fileId}`);
		}

		// 2. Parse the CV (implement your parsing logic here)
		const parsedData = await parseCV(file, fileId);

		// 3. Update the outbox entry via API call
		await updateOutboxStatus(
			env,
			logId,
			"completed",
			parsedData as unknown as Record<string, unknown>,
		);

		// 4. Acknowledge the message (automatic if no error is thrown)
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
		// Files are stored in the 'cv' directory after being promoted from quarantine
		const objectKey = `cv/${fileId}`;
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
 * Parse CV file
 * TODO: Implement actual CV parsing logic
 */
async function parseCV(
	fileBuffer: ArrayBuffer,
	fileId: string,
): Promise<ParsedCVData> {
	// Placeholder - implement your CV parsing logic here
	// You might want to:
	// 1. Convert PDF/DOCX to text
	// 2. Extract structured data (name, email, experience, etc.)
	// 3. Use an AI service for parsing

	console.log(`Parsing CV file: ${fileId}`);

	// For now, return a placeholder with the correct structure
	return {
		fileId,
		personalInfo: {
			name: undefined,
			email: undefined,
			phone: undefined,
			location: undefined,
		},
		summary: undefined,
		skills: [],
		experience: [],
		education: [],
		certifications: [],
		languages: [],
		rawText: undefined,
	};
}

/**
 * Update outbox entry status via API
 */
async function updateOutboxStatus(
	env: Env,
	logId: string,
	status: "completed" | "failed",
	data: Record<string, unknown> | null,
	error?: string,
): Promise<void> {
	try {
		const response = await fetch(`${env.API_URL}/api/outbox/${logId}`, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				status,
				data,
				error,
			}),
		});

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
