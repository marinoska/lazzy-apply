import { getSupabase } from "../supabase.js";
import { sendApiRequest } from "./backgroundClient.js";

export interface UploadSignedUrlResponse {
	uploadUrl: string;
	objectKey: string;
	fileId: string;
	expiresIn: number;
}

export type UploadStatus = "uploaded" | "failed";

export interface UploadStatusResponse {
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
	directory?: string,
): Promise<UploadSignedUrlResponse> {
	return sendApiRequest<UploadSignedUrlResponse>("POST", "/uploads/sign", {
		filename,
		contentType,
		fileSize,
		directory,
	});
}

/**
 * Upload a file to a signed URL
 */
export async function uploadFileToSignedUrl(
	file: File,
	signedUrl: string,
): Promise<void> {
	const response = await fetch(signedUrl, {
		method: "PUT",
		headers: {
			"Content-Type": file.type,
			"Content-Length": file.size.toString(),
		},
		body: file,
	});

	if (!response.ok) {
		throw new Error(`Failed to upload file: ${response.statusText}`);
	}
}

/**
 * Update the status of an upload
 */
export async function setUploadStatus(
	fileId: string,
	status: UploadStatus,
	size?: number,
): Promise<UploadStatusResponse> {
	return sendApiRequest<UploadStatusResponse>("POST", "/uploads/status", {
		fileId,
		status,
		...(typeof size === "number" ? { size } : {}),
	});
}
