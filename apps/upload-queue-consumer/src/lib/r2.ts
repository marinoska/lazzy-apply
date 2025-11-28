import type { Env } from "../types";
import { Logger } from "./logger";

const CV_DIRECTORY = "cv";

/**
 * Download file from R2 bucket
 */
export async function downloadFile(
	env: Env,
	fileId: string,
): Promise<ArrayBuffer | null> {
	const logger = new Logger(env);
	try {
		const objectKey = `${CV_DIRECTORY}/${fileId}`;
		logger.debug("Attempting to download from R2", {
			fileId,
			objectKey,
			operation: "download",
		});
		
		const object = await env.UPLOADS_BUCKET.get(objectKey);
		if (!object) {
			logger.error("Object not found in R2", { fileId, objectKey });
			return null;
		}
		
		logger.debug("Object found, downloading", { fileId });
		return await object.arrayBuffer();
	} catch (error) {
		logger.error(
			"Failed to download file from R2",
			{ fileId, operation: "download" },
			error instanceof Error ? error : new Error(String(error)),
		);
		throw error;
	}
}

/**
 * Delete file from R2 bucket
 */
export async function deleteFile(env: Env, fileId: string): Promise<void> {
	const logger = new Logger(env);
	try {
		const objectKey = `${CV_DIRECTORY}/${fileId}`;
		logger.info("Deleting file from R2", {
			fileId,
			objectKey,
			operation: "delete",
		});
		
		await env.UPLOADS_BUCKET.delete(objectKey);
		logger.info("Deleted file from R2", { fileId, operation: "delete" });
	} catch (error) {
		logger.error(
			"Failed to delete file from R2",
			{ fileId, operation: "delete" },
			error instanceof Error ? error : new Error(String(error)),
		);
		throw error;
	}
}
