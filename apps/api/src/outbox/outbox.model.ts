import { Schema, model } from "mongoose";

import type {
	OutboxDocument,
	TOutbox,
} from "./outbox.types.js";
import { OUTBOX_MODEL_NAME } from "./outbox.types.js";
import {
	registerOutboxStatics,
	type OutboxModelWithStatics,
} from "./outbox.statics.js";
import {
	registerOutboxMethods,
	type OutboxMethods,
} from "./outbox.methods.js";

export type OutboxModel = OutboxModelWithStatics;

const outboxSchema = new Schema<
	TOutbox,
	OutboxModel,
	OutboxMethods
>(
	{
		logId: {
			type: String,
			required: true,
			unique: true,
			index: true,
			immutable: true,
		},
		type: {
			type: String,
			enum: ["file_upload"],
			required: true,
			immutable: true,
		},
		status: {
			type: String,
			enum: ["pending", "processing", "completed", "failed"],
			default: "pending",
			index: true,
		},
		fileId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		error: {
			type: String,
			required: false,
		},
		processedAt: {
			type: Date,
			required: false,
		},
	},
	{ timestamps: true },
);

// Index for efficient queue processing
outboxSchema.index({ status: 1, createdAt: 1 });

registerOutboxMethods(outboxSchema);
registerOutboxStatics(outboxSchema);

export type { OutboxDocument } from "./outbox.types.js";

export const OutboxModel = model<TOutbox, OutboxModel>(
	OUTBOX_MODEL_NAME,
	outboxSchema,
);
