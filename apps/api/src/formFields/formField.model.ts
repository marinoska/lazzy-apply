import { Schema, model } from "mongoose";
import { FORM_FIELD_PATHS } from "@lazyapply/types";

import {
	FORM_FIELD_MODEL_NAME,
	type FormFieldDocument,
	type FormFieldMethods,
	type FormFieldModelWithStatics,
	type TFormField,
} from "./formField.types.js";

export type FormFieldModel = FormFieldModelWithStatics;

const formFieldSchema = new Schema<TFormField, FormFieldModel, FormFieldMethods>(
	{
		fieldHash: {
			type: String,
			required: true,
			unique: true,
			index: true,
			immutable: true,
		},
		field: {
			tag: { type: String, required: true, immutable: true },
			type: { type: String, required: true, immutable: true },
			name: { type: String, default: null, immutable: true },
			label: { type: String, default: null, immutable: true },
			placeholder: { type: String, default: null, immutable: true },
			description: { type: String, default: null, immutable: true },
			isFileUpload: { type: Boolean, required: true, immutable: true },
			accept: { type: String, default: null, immutable: true },
		},
		path: {
			type: Schema.Types.Mixed, // string | string[]
			required: true,
		},
		classification: {
			type: String,
			required: true,
			enum: FORM_FIELD_PATHS,
		},
		linkType: {
			type: String,
			default: undefined,
		},
	},
	{ timestamps: true },
);

formFieldSchema.statics.findByHash = async function (
	this: FormFieldModelWithStatics,
	fieldHash: string,
) {
	return this.findOne({ fieldHash });
};

formFieldSchema.statics.findByHashes = async function (
	this: FormFieldModelWithStatics,
	fieldHashes: string[],
) {
	return this.find({ fieldHash: { $in: fieldHashes } }).lean();
};

export type { FormFieldDocument } from "./formField.types.js";

export const FormFieldModel = model<TFormField, FormFieldModel>(
	FORM_FIELD_MODEL_NAME,
	formFieldSchema,
);
