import type { Schema } from "mongoose";

import type {
	CreatePendingUploadParams,
	FileUploadDocument,
	FileUploadMethods,
	FileUploadModelBase,
	FindExistingUploadByHashParams,
	OwnershipContext,
	TFileUpload,
} from "./fileUpload.types.js";

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
	findStalePendingUploads(
		this: FileUploadModelWithStatics,
		cutoff: Date,
		limit: number,
	): Promise<FileUploadDocument[]>;
	findDeletableByFileId(
		this: FileUploadModelWithStatics,
		fileId: string,
		userId: string,
	): Promise<FileUploadDocument | null>;
};

export type FileUploadModelWithStatics = FileUploadModelBase &
	FileUploadStatics;

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

	schema.statics.findExistingCompletedUploadByHash = async function (params) {
		return await this.findOne({
			fileHash: params.fileHash,
			status: { $in: ["uploaded", "deduplicated"] },
			fileId: { $ne: params.excludeFileId },
		}).setOptions({ userId: params.userId });
	};

	schema.statics.findUploadedByFileId = async function (fileId, ownership) {
		return await this.findOne({
			fileId,
			status: "uploaded",
		}).setOptions(ownership);
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

	schema.statics.findDeletableByFileId = async function (fileId, userId) {
		return await this.findOne({
			fileId,
			status: { $ne: "deleted-by-user" },
		}).setOptions({ userId });
	};
};
