import { Types, type Schema } from "mongoose";
import { createLogger } from "@/app/logger.js";
import type { CVDataModel } from "./cvData.model.js";
import type {
	CreateCVDataParams,
	CVDataMethods,
	CVDataStatics,
	TCVData,
} from "./cvData.types.js";

const _logger = createLogger("cvData.statics");

export function registerCVDataStatics(
	schema: Schema<TCVData, CVDataModel, CVDataMethods>,
): void {
	schema.statics.createCVData = async function (
		payload: CreateCVDataParams,
		session,
	) {
		const uploadId =
			typeof payload.uploadId === "string"
				? new Types.ObjectId(payload.uploadId)
				: payload.uploadId;

		const docs = await this.create(
			[{ ...payload, uploadId }],
			session ? { session } : {},
		);
		return docs[0];
	};

	schema.statics.findByUploadId = async function (
		uploadId: string,
		userId: string,
	) {
		const uploadObjectId = Types.ObjectId.isValid(uploadId)
			? new Types.ObjectId(uploadId)
			: uploadId;

		return this.findOne({ uploadId: uploadObjectId })
			.populate({
				path: "uploadId",
				options: { userId },
			})
			.setOptions({ userId });
	};

	schema.statics.findByUserId = async function (userId: string) {
		return this.find({ userId }).sort({ createdAt: -1 });
	};
}

export type { CVDataStatics };
