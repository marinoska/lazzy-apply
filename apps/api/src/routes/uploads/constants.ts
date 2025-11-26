export { MAXIMUM_UPLOAD_SIZE_BYTES } from "@lazyapply/types";

// Upload directories
export const QUARANTINE_DIRECTORY = "quarantine";
export const UPLOAD_DIRECTORY = "cv";

// Upload timing constants
export const SIGNED_URL_TTL_SECONDS = 15;
export const UPLOAD_GRACE_PERIOD_SECONDS = 60; // Time to complete upload after getting URL
export const UPLOAD_TIMEOUT_SECONDS =
	SIGNED_URL_TTL_SECONDS + UPLOAD_GRACE_PERIOD_SECONDS; // 75 seconds

export const uploadStatusValues = [
	"uploaded",
	"failed",
	"deduplicated",
] as const;

export type UploadStatus = (typeof uploadStatusValues)[number];
