import { randomUUID } from "node:crypto";

import type { Schema } from "mongoose";
import mongoose from "mongoose";

import type {
	FileUploadDocument,
	FileUploadMethods,
	MarkUploadCompletedParams,
	MarkUploadDeduplicatedParams,
	TFileUpload,
} from "./fileUpload.types.js";
import type { FileUploadModelWithStatics } from "./fileUpload.statics.js";
import { OutboxModel, type OutboxDocument } from "@/outbox/outbox.model.js";

export const registerFileUploadMethods = (
	schema: Schema<TFileUpload, FileUploadModelWithStatics, FileUploadMethods>,
) => {
	schema.methods.markAsFailed = async function (
		this: FileUploadDocument,
	) {
		this.status = "failed";

		await this.save();

		return this;
	};

	schema.methods.markAsDeduplicated = async function (
		this: FileUploadDocument,
		params: MarkUploadDeduplicatedParams,
	) {
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
			const logId = randomUUID();
			await OutboxModel.create(
				[
					{
						logId,
						type: "file_upload",
						status: "pending",
						fileId: this.fileId,
						userId: this.userId,
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
