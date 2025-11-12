import type { Query, Schema } from "mongoose";

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

const applyOwnershipOptions = <TResult>(
	query: Query<TResult, any>,
	ownership?: OwnershipContext,
) => {
	if (!ownership) {
		return query;
	}

	const options: Record<string, unknown> = {};

	if (ownership.userId) {
		options.userId = ownership.userId;
	}

	if (ownership.skipOwnershipEnforcement) {
		options.skipOwnershipEnforcement = true;
	}

	if (Object.keys(options).length > 0) {
		query.setOptions(options);
	}

	return query;
};

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
		const query = this.findOne({
			fileId,
			status: "pending",
		});

		return await applyOwnershipOptions(query, { userId });
	};

	schema.statics.findExistingCompletedUploadByHash = async function (
		params,
	) {
		const query = this.findOne({
			fileHash: params.fileHash,
			status: { $in: ["uploaded", "deduplicated"] },
			fileId: { $ne: params.excludeFileId },
		});

		return await applyOwnershipOptions(query, { userId: params.userId });
	};

	schema.statics.findUploadedByFileId = async function (
		fileId,
		ownership,
	) {
		const query = this.findOne({
			fileId,
			status: "uploaded",
		});

		return await applyOwnershipOptions(query, ownership);
	};

	schema.statics.markUploadFailed = async function (fileId, ownership) {
		const query = this.findOneAndUpdate(
			{ fileId },
			{ $set: { status: "failed" } },
		);

		return await applyOwnershipOptions(query, ownership);
	};

	schema.statics.markUploadDeduplicated = async function (
		fileId,
		params,
		ownership,
	) {
		const query = this.findOneAndUpdate(
			{ fileId },
			{
				$set: {
					status: "deduplicated",
					deduplicatedFrom: params.deduplicatedFrom,
					fileHash: params.fileHash,
					size: params.size,
				},
			},
		);

		return await applyOwnershipOptions(query, ownership);
	};

	schema.statics.markUploadCompleted = async function (
		fileId,
		params,
		ownership,
	) {
		const query = this.findOneAndUpdate(
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
			{ new: true },
		);

		return await applyOwnershipOptions(query, ownership);
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
