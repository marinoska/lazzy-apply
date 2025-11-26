import type { Schema } from "mongoose";

import type {
	CVDataMethods,
	CVDataStatics,
	CreateCVDataParams,
	TCVData,
} from "./cvData.types.js";
import type { CVDataModel } from "./cvData.model.js";

export function registerCVDataStatics(
	schema: Schema<TCVData, CVDataModel, CVDataMethods>,
): void {
	schema.statics.createCVData = async function (payload: CreateCVDataParams) {
		return this.create(payload);
	};

	schema.statics.findByUploadId = async function (uploadId: string) {
		return this.findOne({ uploadId });
	};

	schema.statics.findByUserId = async function (userId: string) {
		return this.find({ userId }).sort({ createdAt: -1 });
	};
}

export type { CVDataStatics };
