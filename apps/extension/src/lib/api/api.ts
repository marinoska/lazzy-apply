import type { AutofillRequest, ClassifiedField } from "@lazyapply/types";
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
 * Uses direct fetch since R2 presigned URLs have CORS configured
 */
export async function uploadFileToSignedUrl(
	file: File,
	uploadDetails: UploadSignedUrlResponse,
): Promise<void> {
	// Upload directly to R2 using the presigned URL
	// No need to route through background script since R2 CORS allows all origins
	const response = await fetch(uploadDetails.uploadUrl, {
		method: "PUT",
		body: file,
		headers: {
			"Content-Type": file.type,
		},
	});

	if (!response.ok) {
		throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
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

export type ParseStatus = "pending" | "processing" | "completed" | "failed";

export type UploadDTO = {
	fileId: string;
	originalFilename: string;
	contentType: "PDF" | "DOCX";
	status: UploadStatus;
	size?: number;
	createdAt: string;
	updatedAt: string;
	parseStatus: ParseStatus;
};

export interface GetUploadsResponse {
	uploads: UploadDTO[];
	total: number;
	limit: number;
	offset: number;
}

export interface GetUploadsParams {
	limit?: number;
	offset?: number;
}

/**
 * Get user's uploaded files
 */
export async function getUploads(
	params: GetUploadsParams = {},
): Promise<GetUploadsResponse> {
	const queryParams = new URLSearchParams();
	if (params.limit !== undefined) {
		queryParams.append("limit", params.limit.toString());
	}
	if (params.offset !== undefined) {
		queryParams.append("offset", params.offset.toString());
	}

	const queryString = queryParams.toString();
	const path = queryString ? `/uploads?${queryString}` : "/uploads";

	return sendApiRequest<GetUploadsResponse>("GET", path);
}

export interface DeleteUploadResponse {
	fileId: string;
	status: "deleted-by-user";
}

/**
 * Delete an uploaded file
 */
export async function deleteUpload(
	fileId: string,
): Promise<DeleteUploadResponse> {
	return sendApiRequest<DeleteUploadResponse>("DELETE", `/uploads/${fileId}`);
}

/**
 * Classify form fields using AI to map them to CV data paths
 */
export async function classifyFormFields(
	request: AutofillRequest,
): Promise<ClassifiedField[]> {
	return sendApiRequest<ClassifiedField[]>("POST", "/autofill", request);
}
