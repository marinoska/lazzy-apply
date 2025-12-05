import type { ParseCVQueueMessage, TokenUsage } from "@lazyapply/types";
import { context, trace } from "@opentelemetry/api";
import type { Env } from "../types";
import { type ExtractCVDataResult, extractCVData } from "./extractCVData";
import { Logger } from "./logger";
import { updateOutboxStatus } from "./outbox";

type LogContext = {
	uploadId: string;
	fileId: string;
	processId: string;
	userId: string;
	fileType: string;
};

/**
 * Process a single message from the queue
 * Raw text is already extracted and validated at upload time
 */
export async function processMessage(
	payload: ParseCVQueueMessage,
	env: Env,
): Promise<void> {
	const { uploadId, fileId, processId, userId, fileType } = payload;
	const logger = new Logger(env);
	const logContext: LogContext = {
		uploadId,
		fileId,
		processId,
		userId,
		fileType,
	};

	logger.info("Starting message processing", logContext);

	const tracer = trace.getTracer("upload-queue-consumer");
	const span = tracer.startSpan("processMessage");
	setSpanAttributes(span, payload);

	const startTime = Date.now();
	let tokenUsage: TokenUsage | undefined;

	try {
		// Fetch raw text from API (stored in file_upload document)
		const rawText = await fetchRawText(env, uploadId, logger);

		// Extract structured CV data from raw text using AI
		const result = await extractCVFromText(
			rawText,
			fileId,
			env,
			logContext,
			logger,
			tracer,
			span,
		);
		tokenUsage = result.usage;

		// Update outbox status with parsed data
		await updateOutboxWithResult(env, processId, result, tracer, span);

		// Complete processing
		await completeProcessing(logger, logContext, startTime, span);
	} catch (error) {
		await handleProcessingError(
			error,
			env,
			processId,
			logger,
			logContext,
			startTime,
			span,
			tokenUsage,
		);
		throw error;
	}
}

function setSpanAttributes(
	span: ReturnType<ReturnType<typeof trace.getTracer>["startSpan"]>,
	payload: ParseCVQueueMessage,
): void {
	span.setAttribute("uploadId", payload.uploadId);
	span.setAttribute("fileId", payload.fileId);
	span.setAttribute("processId", payload.processId);
	span.setAttribute("userId", payload.userId);
	span.setAttribute("fileType", payload.fileType);
}

/**
 * Fetch raw text from the API (stored in file_upload document)
 */
async function fetchRawText(
	env: Env,
	uploadId: string,
	logger: Logger,
): Promise<string> {
	logger.info("Fetching raw text from API", {
		uploadId,
		operation: "fetch_raw_text",
	});

	const response = await fetch(
		`${env.API_URL}/worker/uploads/${uploadId}/raw-text`,
		{
			method: "GET",
			headers: {
				"X-Worker-Secret": env.WORKER_SECRET,
			},
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`Failed to fetch raw text: ${response.status} ${errorText}`,
		);
	}

	const data = (await response.json()) as { rawText: string };

	logger.info("Raw text fetched successfully", {
		uploadId,
		rawTextLength: data.rawText.length,
		operation: "fetch_raw_text",
	});

	return data.rawText;
}

/**
 * Extract structured CV data from raw text using AI
 */
async function extractCVFromText(
	rawText: string,
	fileId: string,
	env: Env,
	logContext: LogContext,
	logger: Logger,
	tracer: ReturnType<typeof trace.getTracer>,
	parentSpan: ReturnType<ReturnType<typeof trace.getTracer>["startSpan"]>,
): Promise<ExtractCVDataResult> {
	logger.info("Starting CV data extraction", {
		...logContext,
		operation: "extract",
	});

	const extractStart = Date.now();
	const extractSpan = tracer.startSpan(
		"extractCVData",
		{},
		context
			.active()
			.setValue(Symbol.for("OpenTelemetry Context Key SPAN"), parentSpan),
	);
	extractSpan.setAttribute("fileId", fileId);
	extractSpan.setAttribute("rawTextLength", rawText.length);

	const result = await extractCVData(rawText, env);

	extractSpan.setAttribute("promptTokens", result.usage.promptTokens);
	extractSpan.setAttribute("completionTokens", result.usage.completionTokens);
	extractSpan.setAttribute("totalTokens", result.usage.totalTokens);
	extractSpan.end();
	const extractDuration = Date.now() - extractStart;

	logger.info("CV data extraction completed", {
		...logContext,
		operation: "extract",
		duration: extractDuration,
		promptTokens: result.usage.promptTokens,
		completionTokens: result.usage.completionTokens,
		totalTokens: result.usage.totalTokens,
		inputCost: result.usage.inputCost,
		outputCost: result.usage.outputCost,
		totalCost: result.usage.totalCost,
	});

	return result;
}

async function updateOutboxWithResult(
	env: Env,
	processId: string,
	result: ExtractCVDataResult,
	tracer: ReturnType<typeof trace.getTracer>,
	parentSpan: ReturnType<ReturnType<typeof trace.getTracer>["startSpan"]>,
): Promise<void> {
	const updateSpan = tracer.startSpan(
		"updateOutboxStatus",
		{},
		context
			.active()
			.setValue(Symbol.for("OpenTelemetry Context Key SPAN"), parentSpan),
	);
	updateSpan.setAttribute("processId", processId);
	updateSpan.setAttribute("status", result.parseStatus);

	if (result.parseStatus === "not-a-cv") {
		// Document is not a CV - update status accordingly
		await updateOutboxStatus(
			env,
			processId,
			"not-a-cv",
			null,
			undefined,
			result.usage,
		);
	} else {
		// Successfully parsed CV
		await updateOutboxStatus(
			env,
			processId,
			"completed",
			result.parsedData,
			undefined,
			result.usage,
		);
	}

	updateSpan.end();
}

async function completeProcessing(
	logger: Logger,
	logContext: LogContext,
	startTime: number,
	span: ReturnType<ReturnType<typeof trace.getTracer>["startSpan"]>,
): Promise<void> {
	const totalDuration = Date.now() - startTime;

	logger.info("Successfully processed message", {
		...logContext,
		operation: "complete",
		duration: totalDuration,
		status: "success",
	});

	span.setStatus({ code: 1 }); // OK status
	span.end();
	await logger.flush();
}

async function handleProcessingError(
	error: unknown,
	env: Env,
	processId: string,
	logger: Logger,
	logContext: LogContext,
	startTime: number,
	span: ReturnType<ReturnType<typeof trace.getTracer>["startSpan"]>,
	tokenUsage?: TokenUsage,
): Promise<void> {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const totalDuration = Date.now() - startTime;

	logger.error(
		"Error processing message",
		{
			...logContext,
			operation: "complete",
			duration: totalDuration,
			status: "failed",
			...(tokenUsage && {
				promptTokens: tokenUsage.promptTokens,
				completionTokens: tokenUsage.completionTokens,
				totalTokens: tokenUsage.totalTokens,
				inputCost: tokenUsage.inputCost,
				outputCost: tokenUsage.outputCost,
				totalCost: tokenUsage.totalCost,
			}),
		},
		error instanceof Error ? error : new Error(String(error)),
	);

	// Update outbox to failed status - include token usage if available
	await updateOutboxStatus(
		env,
		processId,
		"failed",
		null,
		errorMessage,
		tokenUsage,
	);

	// Record error in span
	span.recordException(
		error instanceof Error ? error : new Error(String(error)),
	);
	span.setStatus({ code: 2, message: errorMessage }); // ERROR status
	span.end();
	await logger.flush();
}
