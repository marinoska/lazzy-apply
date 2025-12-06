import { FILE_UPLOAD_CONTENT_TYPES } from "@lazyapply/types";
import { model, Schema } from "mongoose";
import { registerOutboxStatics } from "./outbox.statics.js";
import type {
	OutboxMethods,
	OutboxModelWithStatics,
	TOutbox,
} from "./outbox.types.js";
import { OUTBOX_MODEL_NAME } from "./outbox.types.js";

export type OutboxModel = OutboxModelWithStatics;

/**
 * Outbox collection uses event-sourcing pattern:
 * - Documents are NEVER updated, only new documents are created
 * - All fields are immutable
 * - Status transitions create new documents (pending → sending → processing → completed/failed)
 * - Unique index on (fileId, processId, status) prevents duplicate status entries
 */
const outboxSchema = new Schema<TOutbox, OutboxModel, OutboxMethods>(
	{
		processId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		status: {
			type: String,
			enum: [
				"pending",
				"sending",
				"processing",
				"completed",
				"failed",
				"not-a-cv",
			],
			default: "pending",
			index: true,
			immutable: true,
		},
		type: {
			type: String,
			enum: ["file_upload"],
			required: true,
			immutable: true,
		},
		uploadId: {
			type: Schema.Types.ObjectId,
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
		promptTokens: {
			type: Number,
			required: false,
		},
		completionTokens: {
			type: Number,
			required: false,
		},
		totalTokens: {
			type: Number,
			required: false,
		},
		inputCost: {
			type: Number,
			required: false,
		},
		outputCost: {
			type: Number,
			required: false,
		},
		totalCost: {
			type: Number,
			required: false,
		},
	},
	{ timestamps: true, collection: OUTBOX_MODEL_NAME },
);

// Index for efficient queue processing - get latest entry per processId
outboxSchema.index({ processId: 1, createdAt: -1 });
outboxSchema.index({ status: 1, createdAt: 1 });

// Unique index to prevent duplicate status entries for the same file/process
outboxSchema.index({ fileId: 1, processId: 1, status: 1 }, { unique: true });

// Block all updates - event-sourcing pattern requires creating new documents
outboxSchema.pre("findOneAndUpdate", () => {
	throw new Error("Updates not allowed on immutable outbox collection");
});

outboxSchema.pre("updateOne", () => {
	throw new Error("Updates not allowed on immutable outbox collection");
});

outboxSchema.pre("updateMany", () => {
	throw new Error("Updates not allowed on immutable outbox collection");
});

outboxSchema.pre("save", function () {
	if (!this.isNew) {
		throw new Error("Updates not allowed on immutable outbox collection");
	}
});

registerOutboxStatics(outboxSchema);

export type { OutboxDocument } from "./outbox.types.js";

export const OutboxModel = model<TOutbox, OutboxModel>(
	OUTBOX_MODEL_NAME,
	outboxSchema,
);
