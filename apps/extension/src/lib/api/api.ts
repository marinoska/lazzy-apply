import type {
	AutofillRequest,
	ClassifiedField,
	FileUploadContentType,
	FileUploadStatus,
	ParseStatus,
} from "@lazyapply/types";
import { sendApiRequest, sendUploadRequest } from "./backgroundClient.js";

export type { FileUploadStatus as UploadStatus, ParseStatus };

export interface UploadResponse {
	fileId: string;
	objectKey: string;
	size: number;
	contentType: FileUploadContentType;
}

/**
 * Upload a file to the Edge Function
 * This is the single entry point for all file uploads
 */
export async function uploadFile(file: File): Promise<UploadResponse> {
	return sendUploadRequest(file);
}

// Re-export for backward compatibility
export type { UploadResponse as CompleteUploadResponse };

export type UploadDTO = {
	fileId: string;
	originalFilename: string;
	contentType: "PDF" | "DOCX";
	status: FileUploadStatus;
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
