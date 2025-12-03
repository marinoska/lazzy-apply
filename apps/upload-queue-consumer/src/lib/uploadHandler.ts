import {
	CV_DIRECTORY,
	type FileUploadContentType,
	MAXIMUM_RAW_TEXT_BYTES,
	MAXIMUM_UPLOAD_SIZE_BYTES,
} from "@lazyapply/types";
import { secureCompare } from "@lazyapply/utils";
import type { Env } from "../types";
import { extractText } from "./extractText";
import { Logger } from "./logger";

const ALLOWED_CONTENT_TYPES: Record<string, FileUploadContentType> = {
	"application/pdf": "PDF",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		"DOCX",
};

// Chrome extension origin pattern: chrome-extension://<32-char-extension-id>
const CHROME_EXTENSION_ORIGIN_REGEX = /^chrome-extension:\/\/[a-z]{32}$/;

/**
 * Validate that the request originates from a Chrome extension (production only)
 */
function validateChromeExtensionOrigin(
	request: Request,
	env: Env,
	logger: Logger,
): { valid: boolean; error?: string } {
	// Skip validation in non-production environments
	if (env.ENVIRONMENT !== "prod") {
		return { valid: true };
	}

	const origin = request.headers.get("Origin");

	// In production, Origin header must be present and match Chrome extension pattern
	if (!origin) {
		logger.warn("Missing Origin header in production", {
			operation: "validate_origin",
		});
		return { valid: false, error: "Missing Origin header" };
	}

	if (!CHROME_EXTENSION_ORIGIN_REGEX.test(origin)) {
		logger.warn("Invalid Origin - not a Chrome extension", {
			origin,
			operation: "validate_origin",
		});
		return { valid: false, error: "Invalid request origin" };
	}

	logger.debug("Chrome extension origin validated", {
		origin,
		operation: "validate_origin",
	});

	return { valid: true };
}

/**
 * Compute SHA-256 hash of an ArrayBuffer
 */
async function sha256(buffer: ArrayBuffer): Promise<string> {
	const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
	return Array.from(new Uint8Array(hashBuffer))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export interface UploadRequest {
	filename: string;
	contentType: string;
	userId: string;
	userEmail: string;
}

export interface UploadResponse {
	fileId: string;
	objectKey: string;
	size: number;
	contentType: FileUploadContentType;
}

interface InitUploadResponse {
	fileId: string;
	objectKey: string;
	processId: string;
}

interface FinalizeUploadResponse {
	fileId?: string;
	processId?: string;
	error?: string;
	existingFileId?: string;
}

/**
 * Validate the upload request (basic validation before calling API)
 */
function validateRequest(
	request: Request,
	metadata: UploadRequest,
	logger: Logger,
): { valid: true } | { valid: false; error: string; status: number } {
	// Validate content type
	const fileType = ALLOWED_CONTENT_TYPES[metadata.contentType];
	if (!fileType) {
		logger.warn("Invalid content type", {
			contentType: metadata.contentType,
			operation: "validate",
		});
		return {
			valid: false,
			error: `Invalid content type: ${metadata.contentType}. Allowed: PDF, DOCX`,
			status: 400,
		};
	}

	// Validate filename
	if (!metadata.filename || metadata.filename.trim().length === 0) {
		return {
			valid: false,
			error: "Filename is required",
			status: 400,
		};
	}

	// Validate user info
	if (!metadata.userId || !metadata.userEmail) {
		return {
			valid: false,
			error: "User authentication required",
			status: 401,
		};
	}

	// Check content-length header for early rejection
	const contentLength = request.headers.get("content-length");
	if (contentLength) {
		const size = parseInt(contentLength, 10);
		if (size > MAXIMUM_UPLOAD_SIZE_BYTES) {
			logger.warn("File too large (from header)", {
				size,
				maxSize: MAXIMUM_UPLOAD_SIZE_BYTES,
				operation: "validate",
			});
			return {
				valid: false,
				error: `File size (${size} bytes) exceeds maximum allowed size (${MAXIMUM_UPLOAD_SIZE_BYTES} bytes)`,
				status: 413,
			};
		}
	}

	return { valid: true };
}

/**
 * Phase 1: Initialize upload - call API to create pending record
 */
async function initUpload(
	env: Env,
	metadata: UploadRequest,
	fileType: FileUploadContentType,
	logger: Logger,
): Promise<InitUploadResponse> {
	logger.info("Initializing upload via API", {
		filename: metadata.filename,
		contentType: fileType,
		userId: metadata.userId,
		operation: "init",
	});

	const response = await fetch(`${env.API_URL}/worker/uploads/init`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Worker-Secret": env.WORKER_SECRET,
		},
		body: JSON.stringify({
			originalFilename: metadata.filename,
			contentType: fileType,
			userId: metadata.userId,
			userEmail: metadata.userEmail,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		logger.error("API init failed", {
			status: response.status,
			error: errorText,
			operation: "init",
		});
		throw new Error(`API init failed: ${response.status} ${errorText}`);
	}

	const result = (await response.json()) as InitUploadResponse;

	logger.info("Upload initialized", {
		fileId: result.fileId,
		objectKey: result.objectKey,
		operation: "init",
	});

	return result;
}

/**
 * Store file in R2 bucket using the objectKey from init
 */
async function storeFile(
	env: Env,
	objectKey: string,
	fileData: ArrayBuffer,
	contentType: string,
	logger: Logger,
): Promise<number> {
	logger.info("Storing file in R2", {
		objectKey,
		contentType,
		operation: "store",
	});

	const object = await env.UPLOADS_BUCKET.put(objectKey, fileData, {
		httpMetadata: {
			contentType,
		},
	});

	if (!object) {
		throw new Error("Failed to store file in R2");
	}

	logger.info("File stored successfully", {
		objectKey,
		size: object.size,
		operation: "store",
	});

	return object.size;
}

/**
 * Delete file from R2 bucket (rollback on finalize failure)
 */
async function deleteFile(
	env: Env,
	objectKey: string,
	logger: Logger,
): Promise<void> {
	logger.info("Deleting file from R2 (rollback)", {
		objectKey,
		operation: "delete",
	});

	try {
		await env.UPLOADS_BUCKET.delete(objectKey);
		logger.info("File deleted from R2", {
			objectKey,
			operation: "delete",
		});
	} catch (error) {
		logger.error(
			"Failed to delete file from R2",
			{ objectKey, operation: "delete" },
			error instanceof Error ? error : new Error(String(error)),
		);
		// Don't throw - this is cleanup
	}
}

/**
 * Phase 2: Finalize upload - call API to validate, update DB, trigger queue
 */
async function finalizeUpload(
	env: Env,
	fileId: string,
	processId: string,
	size: number,
	rawText: string,
	fileHash: string,
	logger: Logger,
): Promise<FinalizeUploadResponse> {
	logger.info("Finalizing upload via API", {
		fileId,
		processId,
		size,
		rawTextLength: rawText.length,
		operation: "finalize",
	});

	const response = await fetch(`${env.API_URL}/worker/uploads/finalize`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Worker-Secret": env.WORKER_SECRET,
		},
		body: JSON.stringify({
			fileId,
			processId,
			size,
			rawText,
			fileHash,
		}),
	});

	const result = (await response.json()) as FinalizeUploadResponse;

	if (!response.ok) {
		logger.warn("Finalize returned failure", {
			fileId,
			status: response.status,
			error: result.error,
			operation: "finalize",
		});
	} else {
		logger.info("Upload finalized successfully", {
			fileId,
			processId: result.processId,
			operation: "finalize",
		});
	}

	return result;
}

/**
 * Handle file upload request
 * 2-phase upload flow:
 * 1. Call API /init to create pending record, get fileId + objectKey
 * 2. Validate file, extract text
 * 3. Store file in R2
 * 4. Call API /finalize to validate limits, update DB, trigger queue
 * 5. If finalize fails, delete file from R2
 */
export async function handleUpload(
	request: Request,
	env: Env,
): Promise<Response> {
	const logger = new Logger(env);
	let objectKey: string | undefined;

	try {
		// Validate Chrome extension origin (production only)
		const originValidation = validateChromeExtensionOrigin(
			request,
			env,
			logger,
		);
		if (!originValidation.valid) {
			return new Response(JSON.stringify({ error: originValidation.error }), {
				status: 403,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Authenticate extension
		const extensionKey = request.headers.get("X-Extension-Key");
		if (!extensionKey || !secureCompare(extensionKey, env.EXTENSION_SECRET)) {
			logger.warn("Invalid extension key", { operation: "auth" });
			return new Response(JSON.stringify({ error: "Forbidden" }), {
				status: 403,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Parse metadata from headers
		const metadata: UploadRequest = {
			filename: request.headers.get("X-Upload-Filename") ?? "",
			contentType: request.headers.get("Content-Type") ?? "",
			userId: request.headers.get("X-User-Id") ?? "",
			userEmail: request.headers.get("X-User-Email") ?? "",
		};

		logger.info("Processing upload request", {
			filename: metadata.filename,
			contentType: metadata.contentType,
			userId: metadata.userId,
			operation: "upload",
		});

		// Validate metadata and content-length header
		const validation = validateRequest(request, metadata, logger);
		if (!validation.valid) {
			return new Response(JSON.stringify({ error: validation.error }), {
				status: validation.status,
				headers: { "Content-Type": "application/json" },
			});
		}

		// fileType is guaranteed valid after validateRequest
		const fileType = ALLOWED_CONTENT_TYPES[metadata.contentType];

		// Read request body
		const body = request.body;
		if (!body) {
			return new Response(
				JSON.stringify({ error: "Request body is required" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const fileBuffer = await new Response(body).arrayBuffer();

		// Validate actual file size (content-length header can be missing or incorrect)
		if (fileBuffer.byteLength > MAXIMUM_UPLOAD_SIZE_BYTES) {
			const error = `File size (${fileBuffer.byteLength} bytes) exceeds maximum allowed size (${MAXIMUM_UPLOAD_SIZE_BYTES} bytes)`;
			logger.warn("File too large", {
				size: fileBuffer.byteLength,
				maxSize: MAXIMUM_UPLOAD_SIZE_BYTES,
				operation: "validate",
			});
			return new Response(JSON.stringify({ error }), {
				status: 413,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Extract text before calling init (fail fast)
		logger.info("Extracting text from file", {
			fileType,
			operation: "extract_text",
		});

		let rawText: string;
		try {
			rawText = await extractText(fileBuffer, fileType);
		} catch (extractError) {
			const error = `Failed to extract text from ${fileType} file. Please ensure the file is valid.`;
			logger.error(
				"Text extraction failed",
				{ fileType, operation: "extract_text" },
				extractError instanceof Error
					? extractError
					: new Error(String(extractError)),
			);
			return new Response(JSON.stringify({ error }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Early text size validation
		const rawTextBytes = new TextEncoder().encode(rawText).length;
		if (rawTextBytes > MAXIMUM_RAW_TEXT_BYTES) {
			const error = `File content exceeds maximum allowed size (${rawTextBytes} bytes > ${MAXIMUM_RAW_TEXT_BYTES} bytes)`;
			logger.warn("Text too large - rejecting early", {
				rawTextBytes,
				maxBytes: MAXIMUM_RAW_TEXT_BYTES,
				operation: "validate",
			});
			return new Response(JSON.stringify({ error }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		logger.info("Text extraction completed", {
			textLength: rawText.length,
			textBytes: rawTextBytes,
			operation: "extract_text",
		});

		// Phase 1: Initialize upload (creates pending record in DB)
		const initResult = await initUpload(env, metadata, fileType, logger);
		objectKey = initResult.objectKey;

		// Compute file hash for deduplication
		const fileHash = await sha256(fileBuffer);

		// Phase 2: Store file in R2
		const size = await storeFile(
			env,
			objectKey,
			fileBuffer,
			metadata.contentType,
			logger,
		);

		// Phase 3: Finalize upload (validates, updates DB, triggers queue)
		const finalizeResult = await finalizeUpload(
			env,
			initResult.fileId,
			initResult.processId,
			size,
			rawText,
			fileHash,
			logger,
		);

		// Handle finalize failure - delete R2 object
		if (finalizeResult.error) {
			logger.warn("Finalize failed, rolling back R2 upload", {
				fileId: initResult.fileId,
				error: finalizeResult.error,
				operation: "rollback",
			});

			await deleteFile(env, objectKey, logger);

			return new Response(JSON.stringify({ error: finalizeResult.error }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Handle deduplication - return success with existing file info
		if (finalizeResult.existingFileId) {
			logger.info("File deduplicated", {
				fileId: initResult.fileId,
				existingFileId: finalizeResult.existingFileId,
				operation: "deduplicate",
			});

			// Delete the duplicate from R2
			await deleteFile(env, objectKey, logger);

			return new Response(
				JSON.stringify({
					fileId: finalizeResult.existingFileId,
					objectKey: `${CV_DIRECTORY}/${finalizeResult.existingFileId}`,
					size,
					contentType: fileType,
					deduplicated: true,
				}),
				{
					status: 200,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Success
		const response: UploadResponse = {
			fileId: finalizeResult.fileId ?? initResult.fileId,
			objectKey,
			size,
			contentType: fileType,
		};

		logger.info("Upload completed successfully", {
			fileId: response.fileId,
			objectKey,
			size,
			processId: finalizeResult.processId,
			operation: "upload",
		});

		return new Response(JSON.stringify(response), {
			status: 201,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		logger.error(
			"Upload failed",
			{ operation: "upload" },
			error instanceof Error ? error : new Error(String(error)),
		);

		// Clean up R2 if file was stored
		if (objectKey) {
			await deleteFile(env, objectKey, logger);
		}

		return new Response(JSON.stringify({ error: errorMessage }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
