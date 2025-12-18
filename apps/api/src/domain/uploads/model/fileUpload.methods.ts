import { randomUUID } from "node:crypto";

import type { Schema } from "mongoose";
import mongoose from "mongoose";

import { createLogger } from "@/app/logger.js";
import { MUTABLE_STATUS } from "./fileUpload.model.js";
import type { FileUploadModelWithStatics } from "./fileUpload.statics.js";
import type {
	FileUploadDocument,
	FileUploadMethods,
	MarkUploadCompletedParams,
	MarkUploadDeduplicatedParams,
	TFileUpload,
} from "./fileUpload.types.js";
import { OutboxModel } from "./outbox.model.js";

const log = createLogger("FileUpload");

export const registerFileUploadMethods = (
	schema: Schema<TFileUpload, FileUploadModelWithStatics, FileUploadMethods>,
) => {
	schema.methods.isMutable = function (this: FileUploadDocument) {
		return this.status === MUTABLE_STATUS;
	};

	schema.methods.isTerminal = function (this: FileUploadDocument) {
		return this.status !== MUTABLE_STATUS;
	};

	schema.methods.markAsFailed = async function (this: FileUploadDocument) {
		// Skip if already in a locked state (race condition protection)
		if (this.isTerminal()) {
			log.warn(
				{
					fileId: this.fileId,
					status: this.status,
				},
				"Cannot mark upload as failed in a terminal state",
			);
			return this;
		}

		// Update local document to match database
		this.status = "failed";

		await this.save();

		return this;
	};

	schema.methods.markAsDeduplicated = async function (
		this: FileUploadDocument,
		params: MarkUploadDeduplicatedParams,
	) {
		// Skip if already in a locked state (race condition protection)
		if (this.isTerminal()) {
			log.warn(
				{
					fileId: this.fileId,
					status: this.status,
				},
				"Cannot mark upload as deduplicated in a terminal state",
			);
			return this;
		}

		this.status = "deduplicated";
		this.deduplicatedFrom = params.deduplicatedFrom;
		this.size = params.size;

		await this.save();

		return this;
	};

	schema.methods.markAsUploaded = async function (
		this: FileUploadDocument,
		params: MarkUploadCompletedParams,
	) {
		// Skip if already in a locked state (race condition protection)
		if (this.isTerminal()) {
			log.warn(
				{
					fileId: this.fileId,
					status: this.status,
				},
				"Cannot mark upload as uploaded in a terminal state",
			);
			return this;
		}

		// Start a session for transaction
		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			// Update this document's status
			this.status = "uploaded";
			this.objectKey = params.objectKey;
			this.directory = params.directory;
			this.fileHash = params.fileHash;
			this.size = params.size;

			await this.save({ session });

			// Create outbox entry for async queue processing
			// The outbox processor worker will handle sending to Cloudflare parse-cv queue
			const processId = randomUUID();
			await OutboxModel.create(
				[
					{
						processId,
						type: "file_upload",
						status: "pending",
						uploadId: this._id.toString(),
						fileId: this.fileId,
						userId: this.userId,
						fileType: this.contentType,
					},
				],
				{ session },
			);

			// Commit the transaction
			await session.commitTransaction();

			return this;
		} catch (error) {
			// Abort transaction on error
			await session.abortTransaction();
			throw error;
		} finally {
			// End the session
			session.endSession();
		}
	};
};
