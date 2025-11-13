import { randomUUID } from "node:crypto";

import type { Schema } from "mongoose";
import mongoose from "mongoose";

import type {
	CreatePendingUploadParams,
	FileUploadDocument,
	FileUploadMethods,
	FileUploadModelBase,
	FindExistingUploadByHashParams,
	MarkUploadCompletedParams,
	MarkUploadDeduplicatedParams,
	OwnershipContext,
	TFileUpload,
} from "./fileUpload.types.js";
import { OutboxModel } from "@/outbox/outbox.model.js";

export type FileUploadStatics = {
	createPendingUpload(
		this: FileUploadModelWithStatics,
		payload: CreatePendingUploadParams,
	): Promise<FileUploadDocument>;
	findPendingUpload(
		this: FileUploadModelWithStatics,
		fileId: string,
		userId: string,
	): Promise<FileUploadDocument | null>;
	findExistingCompletedUploadByHash(
		this: FileUploadModelWithStatics,
		params: FindExistingUploadByHashParams,
	): Promise<FileUploadDocument | null>;
	findUploadedByFileId(
		this: FileUploadModelWithStatics,
		fileId: string,
		ownership: OwnershipContext,
	): Promise<FileUploadDocument | null>;
	markUploadFailed(
		this: FileUploadModelWithStatics,
		fileId: string,
		ownership: OwnershipContext,
	): Promise<FileUploadDocument | null>;
	markUploadDeduplicated(
		this: FileUploadModelWithStatics,
		fileId: string,
		params: MarkUploadDeduplicatedParams,
		ownership: OwnershipContext,
	): Promise<FileUploadDocument | null>;
	markUploadCompleted(
		this: FileUploadModelWithStatics,
		fileId: string,
		params: MarkUploadCompletedParams,
		ownership: OwnershipContext,
	): Promise<FileUploadDocument | null>;
	findStalePendingUploads(
		this: FileUploadModelWithStatics,
		cutoff: Date,
		limit: number,
	): Promise<FileUploadDocument[]>;
};

export type FileUploadModelWithStatics = FileUploadModelBase & FileUploadStatics;

export const registerFileUploadStatics = (
	schema: Schema<TFileUpload, FileUploadModelWithStatics, FileUploadMethods>,
) => {
	schema.statics.createPendingUpload = async function (payload) {
		return await this.create({
			...payload,
			status: "pending",
		});
	};

	schema.statics.findPendingUpload = async function (fileId, userId) {
		return await this.findOne({
			fileId,
			status: "pending",
		}).setOptions({ userId });
	};

	schema.statics.findExistingCompletedUploadByHash = async function (
		params,
	) {
		return await this.findOne({
			fileHash: params.fileHash,
			status: { $in: ["uploaded", "deduplicated"] },
			fileId: { $ne: params.excludeFileId },
		}).setOptions({ userId: params.userId });
	};

	schema.statics.findUploadedByFileId = async function (
		fileId,
		ownership,
	) {
		return await this.findOne({
			fileId,
			status: "uploaded",
		}).setOptions(ownership);
	};

	schema.statics.markUploadFailed = async function (fileId, ownership) {
		return await this.findOneAndUpdate(
			{ fileId },
			{ $set: { status: "failed" } },
		).setOptions(ownership);
	};

	schema.statics.markUploadDeduplicated = async function (
		fileId,
		params,
		ownership,
	) {
		return await this.findOneAndUpdate(
			{ fileId },
			{
				$set: {
					status: "deduplicated",
					deduplicatedFrom: params.deduplicatedFrom,
					size: params.size,
				},
			},
		).setOptions(ownership);
	};

	schema.statics.markUploadCompleted = async function (
		fileId,
		params,
		ownership,
	) {
		// Start a session for transaction
		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			// Update file upload status
			const updatedUpload = await this.findOneAndUpdate(
				{ fileId },
				{
					$set: {
						status: "uploaded",
						objectKey: params.objectKey,
						directory: params.directory,
						fileHash: params.fileHash,
						size: params.size,
					},
				},
				{ new: true, session },
			).setOptions(ownership);

			if (!updatedUpload) {
				throw new Error(`File upload ${fileId} not found`);
			}

			// Create outbox entry for queue processing
			const logId = randomUUID();
			await OutboxModel.create(
				[
					{
						logId,
						type: "file_upload",
						status: "pending",
						fileId: updatedUpload.fileId,
					},
				],
				{ session },
			);

			// Commit the transaction
			await session.commitTransaction();

			return updatedUpload;
		} catch (error) {
			// Abort transaction on error
			await session.abortTransaction();
			throw error;
		} finally {
			// End the session
			session.endSession();
		}
	};

	schema.statics.findStalePendingUploads = async function (cutoff, limit) {
		return await this.find({
			status: "pending",
			createdAt: { $lt: cutoff },
		})
			.setOptions({ skipOwnershipEnforcement: true })
			.sort({ createdAt: 1 })
			.limit(limit)
			.exec();
	};
};
