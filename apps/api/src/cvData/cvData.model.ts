import { applyOwnershipEnforcement } from "@/app/middleware/mongoOwnershipEnforcement.middleware.js";
import { Schema, model } from "mongoose";

import { registerCVDataMethods } from "./cvData.methods.js";
import { registerCVDataStatics } from "./cvData.statics.js";
import type {
	CVDataDocument,
	CVDataMethods,
	CVDataModelWithStatics,
	TCVData,
} from "./cvData.types.js";
import { CV_DATA_MODEL_NAME } from "./cvData.types.js";

export type CVDataModel = CVDataModelWithStatics;

const cvDataSchema = new Schema<TCVData, CVDataModel, CVDataMethods>(
	{
		uploadId: {
			type: String,
			ref: "file_uploads",
			required: true,
			index: true,
			immutable: true,
		},
		userId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		personal: {
			fullName: { type: String, default: null },
			email: { type: String, default: null },
			phone: { type: String, default: null },
			location: { type: String, default: null },
			nationality: { type: String, default: null },
			rightToWork: { type: String, default: null },
		},
		links: [
			{
				type: { type: String, required: true },
				url: { type: String, required: true },
			},
		],
		summary: { type: String, default: null },
		experience: [
			{
				role: { type: String, default: null },
				company: { type: String, default: null },
				startDate: { type: String, default: null },
				endDate: { type: String, default: null },
				description: { type: String, default: null },
			},
		],
		education: [
			{
				degree: { type: String, default: null },
				field: { type: String, default: null },
				institution: { type: String, default: null },
				startDate: { type: String, default: null },
				endDate: { type: String, default: null },
			},
		],
		certifications: [
			{
				name: { type: String, required: true },
				issuer: { type: String, default: null },
				date: { type: String, default: null },
			},
		],
		languages: [
			{
				language: { type: String, required: true },
				level: { type: String, default: null },
			},
		],
		extras: {
			drivingLicense: { type: String, default: null },
			workPermit: { type: String, default: null },
			willingToRelocate: { type: Boolean, default: null },
			remotePreference: { type: String, default: null },
			noticePeriod: { type: String, default: null },
			availability: { type: String, default: null },
			salaryExpectation: { type: String, default: null },
		},
		rawText: {
			type: String,
			required: true,
		},
	},
	{ timestamps: true },
);

// Index for efficient queries
cvDataSchema.index({ userId: 1, createdAt: -1 });
cvDataSchema.index({ uploadId: 1, userId: 1 });

registerCVDataMethods(cvDataSchema);
registerCVDataStatics(cvDataSchema);

applyOwnershipEnforcement(cvDataSchema);

export type { CVDataDocument } from "./cvData.types.js";

export const CVDataModel = model<TCVData, CVDataModel>(
	CV_DATA_MODEL_NAME,
	cvDataSchema,
);
