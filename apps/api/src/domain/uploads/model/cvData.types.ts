import type { ParsedCVData } from "@lazyapply/types";
import type { ClientSession, Document, Model, Types } from "mongoose";
import type { TFileUpload } from "./fileUpload.types.js";

export const CV_DATA_MODEL_NAME = "cv_data" as const;

// Extract the CV data structure from ParsedCVData (without fileId and _id)
export type ExtractedCVData = Omit<ParsedCVData, "fileId" | "_id">;

export type TCVData = ExtractedCVData & {
	uploadId: Types.ObjectId | string;
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
		session?: ClientSession,
	): Promise<CVDataDocument>;
	findByUploadId(
		this: CVDataModelWithStatics,
		uploadId: string,
		userId: string,
	): Promise<CVDataDocumentPopulated | null>;
	findByUserId(
		this: CVDataModelWithStatics,
		userId: string,
	): Promise<CVDataDocument[]>;
};

export type CVDataDocument = Document & TCVData & CVDataMethods;

export type CVDataDocumentPopulated = Omit<CVDataDocument, "uploadId"> & {
	uploadId: TFileUpload;
};

export type CVDataModelBase = Model<
	TCVData,
	Record<string, never>,
	CVDataMethods
>;

export type CVDataModelWithStatics = CVDataModelBase & CVDataStatics;
