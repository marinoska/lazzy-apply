import type { Document, Model } from "mongoose";

export type OutboxStatus = "pending" | "processing" | "completed" | "failed";

export type OutboxType = "file_upload";

export const OUTBOX_MODEL_NAME = "outbox" as const;

export type TOutbox = {
	logId: string;
	type: OutboxType;
	status: OutboxStatus;
	fileId: string;
	userId: string;
	error?: string;
	processedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateOutboxParams = Pick<
	TOutbox,
	"logId" | "type" | "fileId"
>;

export type OutboxMethods = {
	markAsProcessing(): Promise<OutboxDocument>;
	markAsCompleted(): Promise<OutboxDocument>;
	markAsFailed(error: string): Promise<OutboxDocument>;
};

export type OutboxStatics = {
	createOutbox(
		this: OutboxModelWithStatics,
		payload: CreateOutboxParams,
	): Promise<OutboxDocument>;
	findPendingLogs(
		this: OutboxModelWithStatics,
		limit: number,
	): Promise<OutboxDocument[]>;
	findByFileId(
		this: OutboxModelWithStatics,
		fileId: string,
	): Promise<OutboxDocument | null>;
};

export type OutboxDocument = Document & TOutbox & OutboxMethods;

export type OutboxModelBase = Model<TOutbox>;

export type OutboxModelWithStatics = OutboxModelBase & OutboxStatics;
