export {
	CV_DIRECTORY as UPLOAD_DIRECTORY,
	MAXIMUM_UPLOAD_SIZE_BYTES,
} from "@lazyapply/types";

export const uploadStatusValues = [
	"uploaded",
	"failed",
	"deduplicated",
] as const;

export type UploadStatus = (typeof uploadStatusValues)[number];
