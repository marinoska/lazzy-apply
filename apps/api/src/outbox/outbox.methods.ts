import type { Schema } from "mongoose";

import type {
	OutboxDocument,
	TOutbox,
} from "./outbox.types.js";
import { OUTBOX_MODEL_NAME } from "./outbox.types.js";
import type { OutboxModelWithStatics } from "./outbox.statics.js";

export type OutboxMethods = {
	markAsProcessing(this: OutboxDocument): Promise<OutboxDocument | null>;
	markAsCompleted(this: OutboxDocument): Promise<OutboxDocument | null>;
	markAsFailed(
		this: OutboxDocument,
		error: string,
	): Promise<OutboxDocument | null>;
};

const getModelWithStatics = (
	doc: OutboxDocument,
): OutboxModelWithStatics => {
	return doc.model<TOutbox>(
		OUTBOX_MODEL_NAME,
	) as unknown as OutboxModelWithStatics;
};

export const registerOutboxMethods = (
	schema: Schema<TOutbox, OutboxModelWithStatics, OutboxMethods>,
) => {
	schema.methods.markAsProcessing = async function (this: OutboxDocument) {
		this.status = "processing";
		return await this.save();
	};

	schema.methods.markAsCompleted = async function (this: OutboxDocument) {
		this.status = "completed";
		this.processedAt = new Date();
		return await this.save();
	};

	schema.methods.markAsFailed = async function (
		this: OutboxDocument,
		error: string,
	) {
		this.status = "failed";
		this.error = error;
		this.processedAt = new Date();
		return await this.save();
	};
};
