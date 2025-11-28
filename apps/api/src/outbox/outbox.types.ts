import type { Document, Model } from "mongoose";
import type { FileUploadContentType } from "@lazyapply/types";

export type OutboxStatus = "pending" | "processing" | "completed" | "failed";

export type OutboxType = "file_upload";

export const OUTBOX_MODEL_NAME = "outbox" as const;

export type TOutbox = {
	processId: string;
	type: OutboxType;
	status: OutboxStatus;
	uploadId: string; // MongoDB _id from file_uploads
	fileId: string; // R2 storage filename
	userId: string;
	fileType: FileUploadContentType;
	error?: string;
	processedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateOutboxParams = Pick<TOutbox, "processId" | "type" | "uploadId" | "fileId" | "userId" | "fileType">;

export type OutboxMethods = Record<string, never>;

export type OutboxStatics = {
	createOutbox(
		this: OutboxModelWithStatics,
		payload: CreateOutboxParams,
	): Promise<OutboxDocument>;
	createWithStatus(
		this: OutboxModelWithStatics,
		original: Pick<TOutbox, "processId" | "type" | "uploadId" | "fileId" | "userId" | "fileType">,
		status: OutboxStatus,
		error?: string,
	): Promise<OutboxDocument>;
	markAsProcessing(
		this: OutboxModelWithStatics,
		original: Pick<TOutbox, "processId" | "type" | "uploadId" | "fileId" | "userId" | "fileType">,
	): Promise<OutboxDocument>;
	markAsCompleted(
		this: OutboxModelWithStatics,
		original: Pick<TOutbox, "processId" | "type" | "uploadId" | "fileId" | "userId" | "fileType">,
	): Promise<OutboxDocument>;
	markAsFailed(
		this: OutboxModelWithStatics,
		original: Pick<TOutbox, "processId" | "type" | "uploadId" | "fileId" | "userId" | "fileType">,
		error: string,
	): Promise<OutboxDocument>;
	findPendingLogs(
		this: OutboxModelWithStatics,
		limit: number,
	): Promise<OutboxDocument[]>;
	getPending(
		this: OutboxModelWithStatics,
		limit: number,
	): Promise<OutboxDocument[]>;
	findByFileId(
		this: OutboxModelWithStatics,
		fileId: string,
	): Promise<OutboxDocument | null>;
	findByProcessId(
		this: OutboxModelWithStatics,
		processId: string,
	): Promise<OutboxDocument[]>;
};

export type OutboxDocument = Document & TOutbox & OutboxMethods;

export type OutboxModelBase = Model<
	TOutbox,
	Record<string, never>,
	OutboxMethods
>;

export type OutboxModelWithStatics = OutboxModelBase & OutboxStatics;
