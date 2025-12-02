import { FORM_FIELD_PATHS } from "@lazyapply/types";
import { model, Schema } from "mongoose";

import {
	FORM_FIELD_MODEL_NAME,
	type FormFieldMethods,
	type FormFieldModelWithStatics,
	type TFormField,
} from "./formField.types.js";

export type FormFieldModel = FormFieldModelWithStatics;

const formFieldSchema = new Schema<
	TFormField,
	FormFieldModel,
	FormFieldMethods
>(
	{
		hash: {
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
	hash: string,
) {
	return this.findOne({ hash });
};

formFieldSchema.statics.findByHashes = async function (
	this: FormFieldModelWithStatics,
	hashes: string[],
) {
	return this.find({ hash: { $in: hashes } }).lean();
};

export type { FormFieldDocument } from "./formField.types.js";

export const FormFieldModel = model<TFormField, FormFieldModel>(
	FORM_FIELD_MODEL_NAME,
	formFieldSchema,
);
