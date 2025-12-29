import type { FileUploadContentType } from "@lazyapply/types";
import type { ClientSession, Document, Model, Types } from "mongoose";

export type OutboxStatus =
	| "pending"
	| "sending"
	| "processing"
	| "completed"
	| "failed"
	| "not-a-cv";

export type OutboxType = "file_upload";

export const OUTBOX_MODEL_NAME = "outbox" as const;

export type TOutbox = {
	processId: string;
	type: OutboxType;
	status: OutboxStatus;
	uploadId: Types.ObjectId;
	fileId: string; // R2 storage filename
	userId: string;
	fileType: FileUploadContentType;
	error?: string;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateOutboxParams = Omit<
	Pick<TOutbox, "processId" | "type" | "fileId" | "userId" | "fileType">,
	never
> & {
	uploadId: Types.ObjectId | string;
};

export type OutboxMethods = Record<string, never>;

export type OutboxStatics = {
	createOutbox(
		this: OutboxModelWithStatics,
		payload: CreateOutboxParams,
		session?: ClientSession,
	): Promise<OutboxDocument>;
	createWithStatus(
		this: OutboxModelWithStatics,
		original: Pick<
			TOutbox,
			"processId" | "type" | "uploadId" | "fileId" | "userId" | "fileType"
		>,
		status: OutboxStatus,
		error?: string,
		session?: ClientSession,
	): Promise<OutboxDocument>;
	markAsSending(
		this: OutboxModelWithStatics,
		processId: string,
	): Promise<OutboxDocument | null>;
	markAsProcessing(
		this: OutboxModelWithStatics,
		original: Pick<
			TOutbox,
			"processId" | "type" | "uploadId" | "fileId" | "userId" | "fileType"
		>,
		session?: ClientSession,
	): Promise<OutboxDocument>;
	markAsCompleted(
		this: OutboxModelWithStatics,
		original: Pick<
			TOutbox,
			"processId" | "type" | "uploadId" | "fileId" | "userId" | "fileType"
		>,
		session?: ClientSession,
	): Promise<OutboxDocument>;
	markAsFailed(
		this: OutboxModelWithStatics,
		original: Pick<
			TOutbox,
			"processId" | "type" | "uploadId" | "fileId" | "userId" | "fileType"
		>,
		error: string,
		session?: ClientSession,
	): Promise<OutboxDocument>;
	markAsNotACV(
		this: OutboxModelWithStatics,
		original: Pick<
			TOutbox,
			"processId" | "type" | "uploadId" | "fileId" | "userId" | "fileType"
		>,
		session?: ClientSession,
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
