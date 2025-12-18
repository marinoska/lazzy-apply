import type { ParsedCVData } from "@lazyapply/types";
import type { Document, Model } from "mongoose";

export const CV_DATA_MODEL_NAME = "cv_data" as const;

// Extract the CV data structure from ParsedCVData (without fileId)
export type ExtractedCVData = Omit<ParsedCVData, "fileId">;

export type TCVData = ExtractedCVData & {
	uploadId: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateCVDataParams = Pick<TCVData, "uploadId" | "userId"> &
	ExtractedCVData;

export type CVDataMethods = {
	// Add custom instance methods here if needed
};

export type CVDataStatics = {
	createCVData(
		this: CVDataModelWithStatics,
		payload: CreateCVDataParams,
	): Promise<CVDataDocument>;
	findByUploadId(
		this: CVDataModelWithStatics,
		uploadId: string,
		userId: string,
	): Promise<CVDataDocument | null>;
	findByUserId(
		this: CVDataModelWithStatics,
		userId: string,
	): Promise<CVDataDocument[]>;
};

export type CVDataDocument = Document & TCVData & CVDataMethods;

export type CVDataModelBase = Model<
	TCVData,
	Record<string, never>,
	CVDataMethods
>;

export type CVDataModelWithStatics = CVDataModelBase & CVDataStatics;
