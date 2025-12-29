import type { Schema } from "mongoose";
import type { CVDataModel } from "./cvData.model.js";
import type {
	CreateCVDataParams,
	CVDataMethods,
	CVDataStatics,
	TCVData,
} from "./cvData.types.js";

export function registerCVDataStatics(
	schema: Schema<TCVData, CVDataModel, CVDataMethods>,
): void {
	schema.statics.createCVData = async function (
		payload: CreateCVDataParams,
		session,
	) {
		const docs = await this.create([payload], session ? { session } : {});
		return docs[0];
	};

	schema.statics.findByUploadId = async function (
		uploadId: string,
		userId: string,
	) {
		return this.findOne({ uploadId })
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
