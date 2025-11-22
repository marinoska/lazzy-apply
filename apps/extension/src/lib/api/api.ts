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
 * Routes through background script to avoid CORS issues
 */
export async function uploadFileToSignedUrl(
	file: File,
	uploadDetails: UploadSignedUrlResponse,
): Promise<void> {
	// Convert file to ArrayBuffer for message passing
	const arrayBuffer = await file.arrayBuffer();

	// Send upload request through background script
	// Background script has proper permissions and avoids CORS
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(
			{
				type: "UPLOAD_FILE",
				uploadUrl: uploadDetails.uploadUrl,
				fileData: arrayBuffer,
				contentType: file.type,
			},
			(response) => {
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
					return;
				}

				if (!response || !response.ok) {
					reject(new Error(response?.error || "File upload failed"));
					return;
				}

				resolve();
			},
		);
	});
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
