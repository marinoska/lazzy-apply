import { getSupabase } from "../supabase.js";
import { sendApiRequest } from "./backgroundClient.js";

export interface UploadSignedUrlResponse {
	uploadUrl: string;
	objectKey: string;
	fileId: string;
	expiresIn: number;
}

export type UploadStatus = "uploaded" | "failed" | "deduplicated";

export interface CompleteUploadResponse {
	fileId: string;
	status: UploadStatus;
}

/**
 * Get a signed URL for uploading a file
 */
export async function getUploadSignedUrl(
	filename: string,
	contentType: string,
	fileSize: number,
): Promise<UploadSignedUrlResponse> {
	return sendApiRequest<UploadSignedUrlResponse>("POST", "/uploads/sign", {
		filename,
		contentType,
		fileSize,
	});
}

/**
 * Upload a file to a signed URL using PUT request (Cloudflare R2 compatible)
 */
export async function uploadFileToSignedUrl(
	file: File,
	uploadDetails: UploadSignedUrlResponse,
): Promise<void> {
	const response = await fetch(uploadDetails.uploadUrl, {
		method: "PUT",
		body: file,
		headers: {
			"Content-Type": file.type,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to upload file: ${response.statusText}`);
	}
}

/**
 * Signal that upload is complete and trigger server-side validation
 * Server will validate the file in quarantine and promote it to healthy directory
 * Throws error if file is not ready - client should retry after a delay
 */
export async function completeUpload(
	fileId: string,
): Promise<CompleteUploadResponse> {
	return sendApiRequest<CompleteUploadResponse>("POST", "/uploads/complete", {
		fileId,
	});
}
