import type {
	AutofillRequest,
	AutofillResponse,
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
	_id: string;
	fileId: string;
	originalFilename: string;
	contentType: "PDF" | "DOCX";
	status: FileUploadStatus;
	size?: number;
	isCanonical: boolean;
	createdAt: string;
	updatedAt: string;
	parseStatus: ParseStatus;
};

/**
 * Discriminated union for upload state.
 * Enforces that parseStatus only exists when status is "uploaded".
 */
export type UploadState =
	| { status: Exclude<FileUploadStatus, "uploaded"> }
	| { status: "uploaded"; parseStatus: ParseStatus };

export interface GetUploadsResponse {
	uploads: UploadDTO[];
	selectedUploadId: string | null;
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
 * Returns a record keyed by field hash with classification and CV data values
 */
export async function classifyFormFields(
	request: AutofillRequest,
): Promise<AutofillResponse> {
	return sendApiRequest<AutofillResponse>("POST", "/autofill", request);
}

// Preferences types
export interface UpdateSelectedUploadRequest {
	selectedUploadId: string | null;
}

export interface UpdateSelectedUploadResponse {
	selectedUploadId: string | null;
}

/**
 * Update selected upload preference
 */
export async function updateSelectedUpload(
	selectedUploadId: string | null,
): Promise<UpdateSelectedUploadResponse> {
	return sendApiRequest<UpdateSelectedUploadResponse>(
		"PATCH",
		"/preferences/selected-upload",
		{ selectedUploadId } satisfies UpdateSelectedUploadRequest,
	);
}
