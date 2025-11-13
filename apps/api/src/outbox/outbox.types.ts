import type { Document, Model } from "mongoose";
import type { OutboxMethods } from "./outbox.methods.js";

export type OutboxStatus = "pending" | "processing" | "completed" | "failed";

export type OutboxType = "file_upload";

export const OUTBOX_MODEL_NAME = "outbox" as const;

export type TOutbox = {
	logId: string;
	type: OutboxType;
	status: OutboxStatus;
	fileId: string;
	error?: string;
	processedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateOutboxParams = Pick<
	TOutbox,
	"logId" | "type" | "fileId"
>;

export type OutboxDocument = Document & TOutbox & OutboxMethods;

export type OutboxModelBase = Model<TOutbox>;
