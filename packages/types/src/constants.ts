// Shared constants for LazyApply

/**
 * Maximum file size allowed for CV uploads (5MB)
 */
export const MAXIMUM_UPLOAD_SIZE_BYTES = 5_242_880; // 5MB

/**
 * Maximum raw text size after extraction (80KB)
 * Text exceeding this limit will be truncated
 */
export const MAXIMUM_RAW_TEXT_BYTES = 81920; // 80KB

/**
 * R2 directory for CV files
 */
export const CV_DIRECTORY = "cv";

/**
 * Cloudflare Queue message ID header for idempotency
 */
export const CF_QUEUE_MESSAGE_ID_HEADER = "CF-Queue-Message-Id";
