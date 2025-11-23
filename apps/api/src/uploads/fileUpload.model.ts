import { createLogger } from "@/app/logger.js";
import { applyOwnershipEnforcement } from "@/app/middleware/mongoOwnershipEnforcement.middleware.js";
import { Schema, model } from "mongoose";

import { registerFileUploadMethods } from "./fileUpload.methods.js";
import {
	type FileUploadModelWithStatics,
	registerFileUploadStatics,
} from "./fileUpload.statics.js";
import type {
	FileUploadDocument,
	FileUploadMethods,
	TFileUpload,
} from "./fileUpload.types.js";
import { FILE_UPLOAD_MODEL_NAME } from "./fileUpload.types.js";

const log = createLogger("FileUploadModel");

export const MUTABLE_STATUS = "pending";

export type FileUploadModel = FileUploadModelWithStatics;

const fileUploadSchema = new Schema<
	TFileUpload,
	FileUploadModel,
	FileUploadMethods
>(
	{
		fileId: {
			type: String,
			required: true,
			unique: true,
			index: true,
			immutable: true,
		},
		objectKey: {
			type: String,
			required: true,
			unique: true,
			immutable: true,
		},
		originalFilename: {
			type: String,
			required: true,
			immutable: true,
		},
		contentType: {
			type: String,
			enum: ["PDF", "DOCX"],
			required: true,
			immutable: true,
		},
		directory: {
			type: String,
			required: true,
		},
		bucket: {
			type: String,
			required: true,
			immutable: true,
		},
		userId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		userEmail: {
			type: String,
			immutable: true,
		},
		status: {
			type: String,
			enum: ["pending", "uploaded", "failed", "deduplicated"],
			default: "pending",
		},
		deduplicatedFrom: {
			type: String,
			index: true,
		},
		uploadUrlExpiresAt: {
			type: Date,
			required: true,
			immutable: true,
		},
		size: {
			type: Number,
			immutable: true,
		},
		fileHash: {
			type: String,
			unique: true,
			sparse: true,
		},
	},
	{ timestamps: true },
);

// Store original values when document is loaded
fileUploadSchema.post("init", (doc) => {
	doc.$locals.immutable = doc.status !== MUTABLE_STATUS;
});

// Prevent updates to records that are not in mutable state
fileUploadSchema.pre("save", async function (this, next) {
	if (this.isNew) {
		return next();
	}

	if (this.isModified("status")) {
		if (this.$locals.immutable) {
			throw new Error(
				`Cannot modify file upload in terminal state: ${this.status}`,
			);
		}
	}

	next();
});

// Prevent updates via findOneAndUpdate, updateOne, etc.
fileUploadSchema.pre(
	["findOneAndUpdate", "updateOne", "updateMany"],
	async function (this, next) {
		// Get the filter to find which documents are being updated
		const filter = this.getFilter();

		// If filter already includes status: "pending", the query is self-protecting
		// (it won't match locked documents, so no need to check)
		if (filter.status === "pending") {
			log.warn(
				{ filter },
				"Update to an initial state is not allowed. Skipping",
			);
			return next();
		}

		// Check if any matching documents are not in mutable state
		const docs = await this.model
			.find(filter)
			.setOptions({ skipOwnershipEnforcement: true });

		for (const doc of docs) {
			if (!doc.isMutable()) {
				throw new Error(
					`Cannot modify file upload in locked state: ${doc.status}`,
				);
			}
		}

		next();
	},
);

registerFileUploadMethods(fileUploadSchema);
registerFileUploadStatics(fileUploadSchema);

applyOwnershipEnforcement(fileUploadSchema);

export type { FileUploadDocument } from "./fileUpload.types.js";

export const FileUploadModel = model<TFileUpload, FileUploadModel>(
	FILE_UPLOAD_MODEL_NAME,
	fileUploadSchema,
);
