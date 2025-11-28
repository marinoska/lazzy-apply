import { Schema, model } from "mongoose";
import { FILE_UPLOAD_CONTENT_TYPES } from "@lazyapply/types";

import type {
	OutboxDocument,
	OutboxMethods,
	OutboxModelWithStatics,
	TOutbox,
} from "./outbox.types.js";
import { OUTBOX_MODEL_NAME } from "./outbox.types.js";
import { registerOutboxStatics } from "./outbox.statics.js";

export type OutboxModel = OutboxModelWithStatics;

const outboxSchema = new Schema<
	TOutbox,
	OutboxModel,
	OutboxMethods
>(
	{
		processId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		status: {
			type: String,
			enum: ["pending", "processing", "completed", "failed"],
			default: "pending",
			index: true,
		},
		type: {
			type: String,
			enum: ["file_upload"],
			required: true,
			immutable: true,
		},
		uploadId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
			ref: "file_uploads",
		},
		fileId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		userId: {
			type: String,
			required: true,
			immutable: true,
		},
		fileType: {
			type: String,
			enum: FILE_UPLOAD_CONTENT_TYPES,
			required: true,
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

// Index for efficient queue processing - get latest entry per processId
outboxSchema.index({ processId: 1, createdAt: -1 });
outboxSchema.index({ status: 1, createdAt: 1 });

// Make collection immutable - prevent all updates
outboxSchema.pre('findOneAndUpdate', function() {
	throw new Error('Updates not allowed on immutable outbox collection');
});

outboxSchema.pre('updateOne', function() {
	throw new Error('Updates not allowed on immutable outbox collection');
});

outboxSchema.pre('updateMany', function() {
	throw new Error('Updates not allowed on immutable outbox collection');
});

outboxSchema.pre('save', function() {
	if (!this.isNew) {
		throw new Error('Updates not allowed on immutable outbox collection');
	}
});

registerOutboxStatics(outboxSchema);

export type { OutboxDocument } from "./outbox.types.js";

export const OutboxModel = model<TOutbox, OutboxModel>(
	OUTBOX_MODEL_NAME,
	outboxSchema,
);
