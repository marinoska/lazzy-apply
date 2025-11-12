import type { Schema } from "mongoose";

import type {
	FileUploadDocument,
	FileUploadMethods,
	MarkUploadCompletedParams,
	MarkUploadDeduplicatedParams,
	OwnershipContext,
	TFileUpload,
} from "./fileUpload.types.js";
import { FILE_UPLOAD_MODEL_NAME } from "./fileUpload.types.js";
import type { FileUploadModelWithStatics } from "./fileUpload.statics.js";

const resolveOwnership = (
	doc: FileUploadDocument,
	ownership?: OwnershipContext,
): OwnershipContext => {
	if (ownership) {
		return ownership;
	}

	return { userId: doc.userId };
};

const getModelWithStatics = (
	doc: FileUploadDocument,
): FileUploadModelWithStatics => {
	return doc.model<TFileUpload>(
		FILE_UPLOAD_MODEL_NAME,
	) as unknown as FileUploadModelWithStatics;
};

export const registerFileUploadMethods = (
	schema: Schema<TFileUpload, FileUploadModelWithStatics, FileUploadMethods>,
) => {
	schema.methods.markAsFailed = async function (
		this: FileUploadDocument,
		ownership?: OwnershipContext,
	) {
		const model = getModelWithStatics(this);
		return await model.markUploadFailed(
			this.fileId,
			resolveOwnership(this, ownership),
		);
	};

	schema.methods.markAsDeduplicated = async function (
		this: FileUploadDocument,
		params: MarkUploadDeduplicatedParams,
		ownership?: OwnershipContext,
	) {
		const model = getModelWithStatics(this);
		return await model.markUploadDeduplicated(
			this.fileId,
			params,
			resolveOwnership(this, ownership),
		);
	};

	schema.methods.markAsUploaded = async function (
		this: FileUploadDocument,
		params: MarkUploadCompletedParams,
		ownership?: OwnershipContext,
	) {
		const model = getModelWithStatics(this);
		return await model.markUploadCompleted(
			this.fileId,
			params,
			resolveOwnership(this, ownership),
		);
	};
};
