import { model, Schema } from "mongoose";
import {
	AUTOFILL_MODEL_NAME,
	type AutofillMethods,
	type AutofillModelWithStatics,
	type TAutofill,
} from "./autofill.types.js";
import { FORM_FIELD_MODEL_NAME, FORM_MODEL_NAME } from "./formField.types.js";

export type AutofillModel = AutofillModelWithStatics;

const autofillSchema = new Schema<TAutofill, AutofillModel, AutofillMethods>(
	{
		userId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		autofillId: {
			type: String,
			required: true,
			unique: true,
			index: true,
			immutable: true,
		},
		formReference: {
			type: Schema.Types.ObjectId,
			ref: FORM_MODEL_NAME,
			required: true,
			index: true,
			immutable: true,
		},
		uploadReference: {
			type: Schema.Types.ObjectId,
			ref: "file_uploads",
			required: true,
			index: true,
			immutable: true,
		},
		data: {
			type: [
				{
					hash: { type: String, required: true, index: true, immutable: true },
					fieldRef: {
						type: Schema.Types.ObjectId,
						ref: FORM_FIELD_MODEL_NAME,
						required: true,
						immutable: true,
					},
					fieldName: { type: String, required: true, immutable: true },
					// Text field value (mutually exclusive with file fields)
					value: { type: String, immutable: true },
					// File upload fields (mutually exclusive with value)
					fileUrl: { type: String, immutable: true },
					fileName: { type: String, immutable: true },
					fileContentType: { type: String, immutable: true },
				},
			],
			required: true,
			immutable: true,
			validate: {
				validator: (
					data: Array<{
						value?: string;
						fileUrl?: string;
						fileName?: string;
						fileContentType?: string;
					}>,
				) =>
					data.every((item) => {
						const hasValue = item.value !== undefined && item.value !== null;
						const hasFileFields =
							item.fileUrl !== undefined &&
							item.fileName !== undefined &&
							item.fileContentType !== undefined;
						return hasValue !== hasFileFields;
					}),
				message:
					"Each data item must have either value OR all file fields (fileUrl, fileName, fileContentType), not both or neither",
			},
		},
	},
	{ timestamps: true, collection: AUTOFILL_MODEL_NAME },
);

// Compound index for efficient lookups by user, upload, form, and autofillId
// Supports queries by userId/uploadReference/formReference or all 4 fields
autofillSchema.index({
	userId: 1,
	uploadReference: 1,
	formReference: 1,
	autofillId: 1,
});

// Static methods
autofillSchema.statics.createAutofill = async function (
	this: AutofillModelWithStatics,
	params,
) {
	const result = await this.create(params);
	return result;
};

autofillSchema.statics.findByAutofillId = async function (
	this: AutofillModelWithStatics,
	autofillId: string,
) {
	return this.findOne({ autofillId });
};

autofillSchema.statics.findByUserId = async function (
	this: AutofillModelWithStatics,
	userId: string,
) {
	return this.find({ userId }).lean();
};

autofillSchema.statics.findMostRecentByUserUploadForm = async function (
	this: AutofillModelWithStatics,
	userId: string,
	uploadId: string,
	formId: string,
) {
	return this.findOne({
		userId,
		uploadReference: uploadId,
		formReference: formId,
	})
		.sort({ createdAt: -1 })
		.exec();
};

export type { AutofillDocument } from "./autofill.types.js";

export const AutofillModel = model<TAutofill, AutofillModel>(
	AUTOFILL_MODEL_NAME,
	autofillSchema,
);
