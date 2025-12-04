import type { FileUploadContentType, FileUploadStatus } from "@lazyapply/types";
import type { Document, Model } from "mongoose";

export type { FileUploadStatus };

export const FILE_UPLOAD_MODEL_NAME = "file_uploads" as const;

export type OwnershipContext = {
	userId?: string;
	skipOwnershipEnforcement?: boolean;
};

export type TFileUpload = {
	fileId: string;
	objectKey: string;
	originalFilename: string;
	contentType: FileUploadContentType;
	directory: string;
	bucket: string;
	userId: string;
	userEmail?: string;
	status: FileUploadStatus;
	deduplicatedFrom?: string;
	size?: number;
	/** Raw text size in bytes */
	rawTextSize?: number;
	fileHash?: string;
	/** Raw text extracted from the CV at upload time */
	rawText?: string;
	/** Rejection reason if status is 'rejected' */
	rejectionReason?: string;
	createdAt: Date;
	updatedAt: Date;
};

export type CreatePendingUploadParams = Pick<
	TFileUpload,
	| "fileId"
	| "objectKey"
	| "originalFilename"
	| "contentType"
	| "directory"
	| "bucket"
	| "userId"
	| "userEmail"
>;

export type FindExistingUploadByHashParams = {
	fileHash: string;
	excludeFileId: string;
	userId: string;
};

export type MarkUploadDeduplicatedParams = {
	deduplicatedFrom: string;
	size: number;
};

export type MarkUploadCompletedParams = {
	objectKey: string;
	directory: string;
	fileHash: string;
	size: number;
};

export type FileUploadDocument = Document & TFileUpload & FileUploadMethods;

export type FileUploadMethods = {
	isMutable(this: FileUploadDocument): boolean;
	isTerminal(this: FileUploadDocument): boolean;
	markAsFailed(this: FileUploadDocument): Promise<FileUploadDocument>;
	markAsDeduplicated(
		this: FileUploadDocument,
		params: MarkUploadDeduplicatedParams,
	): Promise<FileUploadDocument>;
	markAsUploaded(
		this: FileUploadDocument,
		params: MarkUploadCompletedParams,
	): Promise<FileUploadDocument>;
};

export type FileUploadModelBase = Model<TFileUpload>;
