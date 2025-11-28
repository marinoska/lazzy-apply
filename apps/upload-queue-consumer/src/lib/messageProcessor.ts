import type { ParseCVQueueMessage } from "@lazyapply/types";
import { MAXIMUM_UPLOAD_SIZE_BYTES } from "@lazyapply/types";
import { trace, context } from "@opentelemetry/api";
import type { Env } from "../types";
import { Logger } from "./logger";
import { downloadFile, deleteFile } from "./r2";
import { parseCV } from "./cvParser";
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
 */
export async function processMessage(
	payload: ParseCVQueueMessage,
	env: Env,
): Promise<void> {
	const { uploadId, fileId, processId, userId, fileType } = payload;
	const logger = new Logger(env);
	const logContext: LogContext = { uploadId, fileId, processId, userId, fileType };

	logger.info("Starting message processing", logContext);

	const tracer = trace.getTracer("upload-queue-consumer");
	const span = tracer.startSpan("processMessage");
	setSpanAttributes(span, payload);

	const startTime = Date.now();

	try {
		// 1. Download and validate file
		const file = await downloadAndValidateFile(env, fileId, logContext, logger, tracer, span);

		// 2. Parse the CV
		const parsedData = await parseCVFile(file, fileId, fileType, env, logContext, logger, tracer, span);

		// 3. Update outbox status
		await updateOutboxWithResult(env, processId, parsedData, tracer, span);

		// 4. Complete processing
		await completeProcessing(logger, logContext, startTime, span);
	} catch (error) {
		await handleProcessingError(error, env, processId, logger, logContext, startTime, span);
		throw error;
	}
}

function setSpanAttributes(span: ReturnType<ReturnType<typeof trace.getTracer>["startSpan"]>, payload: ParseCVQueueMessage): void {
	span.setAttribute("uploadId", payload.uploadId);
	span.setAttribute("fileId", payload.fileId);
	span.setAttribute("processId", payload.processId);
	span.setAttribute("userId", payload.userId);
	span.setAttribute("fileType", payload.fileType);
}

async function downloadAndValidateFile(
	env: Env,
	fileId: string,
	logContext: LogContext,
	logger: Logger,
	tracer: ReturnType<typeof trace.getTracer>,
	parentSpan: ReturnType<ReturnType<typeof trace.getTracer>["startSpan"]>,
): Promise<ArrayBuffer> {
	logger.info("Downloading file from R2", { ...logContext, operation: "download" });
	
	const downloadSpan = tracer.startSpan(
		"downloadFile",
		{},
		context.active().setValue(Symbol.for("OpenTelemetry Context Key SPAN"), parentSpan),
	);

	const file = await downloadFile(env, fileId);
	
	if (!file) {
		downloadSpan.recordException(new Error(`File not found in R2: ${fileId}`));
		downloadSpan.end();
		logger.error("File not found in R2", logContext);
		throw new Error(`File not found in R2: ${fileId}`);
	}

	downloadSpan.setAttribute("fileSize", file.byteLength);
	downloadSpan.end();
	
	logger.info("File downloaded successfully", {
		...logContext,
		fileSize: file.byteLength,
		operation: "download",
	});

	// Validate file size
	if (file.byteLength > MAXIMUM_UPLOAD_SIZE_BYTES) {
		logger.warn("File size exceeds limit, deleting file", {
			...logContext,
			fileSize: file.byteLength,
			maxSize: MAXIMUM_UPLOAD_SIZE_BYTES,
			operation: "validate",
		});
		await deleteFile(env, fileId);
		throw new Error(
			`File size (${file.byteLength} bytes) exceeds maximum allowed size (${MAXIMUM_UPLOAD_SIZE_BYTES} bytes)`,
		);
	}

	return file;
}

async function parseCVFile(
	file: ArrayBuffer,
	fileId: string,
	fileType: ParseCVQueueMessage["fileType"],
	env: Env,
	logContext: LogContext,
	logger: Logger,
	tracer: ReturnType<typeof trace.getTracer>,
	parentSpan: ReturnType<ReturnType<typeof trace.getTracer>["startSpan"]>,
) {
	logger.info("Starting CV parsing", { ...logContext, operation: "parse" });
	
	const parseStart = Date.now();
	const parseSpan = tracer.startSpan(
		"parseCV",
		{},
		context.active().setValue(Symbol.for("OpenTelemetry Context Key SPAN"), parentSpan),
	);
	parseSpan.setAttribute("fileId", fileId);
	parseSpan.setAttribute("fileType", fileType);

	const parsedData = await parseCV(file, fileId, fileType, env);
	
	parseSpan.end();
	const parseDuration = Date.now() - parseStart;
	
	logger.info("CV parsing completed", {
		...logContext,
		operation: "parse",
		duration: parseDuration,
	});

	return parsedData;
}

async function updateOutboxWithResult(
	env: Env,
	processId: string,
	parsedData: Awaited<ReturnType<typeof parseCV>>,
	tracer: ReturnType<typeof trace.getTracer>,
	parentSpan: ReturnType<ReturnType<typeof trace.getTracer>["startSpan"]>,
): Promise<void> {
	const updateSpan = tracer.startSpan(
		"updateOutboxStatus",
		{},
		context.active().setValue(Symbol.for("OpenTelemetry Context Key SPAN"), parentSpan),
	);
	updateSpan.setAttribute("processId", processId);
	updateSpan.setAttribute("status", "completed");

	await updateOutboxStatus(env, processId, "completed", parsedData);
	
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
		},
		error instanceof Error ? error : new Error(String(error)),
	);

	// Update outbox to failed status
	await updateOutboxStatus(env, processId, "failed", null, errorMessage);

	// Record error in span
	span.recordException(error instanceof Error ? error : new Error(String(error)));
	span.setStatus({ code: 2, message: errorMessage }); // ERROR status
	span.end();
	await logger.flush();
}
