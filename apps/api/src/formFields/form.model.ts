import { Schema, model } from "mongoose";

import {
	FORM_MODEL_NAME,
	type FormDocument,
	type FormMethods,
	type FormModelWithStatics,
	type TForm,
} from "./formField.types.js";

export type FormModel = FormModelWithStatics;

const formSchema = new Schema<TForm, FormModel, FormMethods>(
	{
		formHash: {
			type: String,
			required: true,
			unique: true,
			index: true,
			immutable: true,
		},
		fields: {
			type: [
				{
					hash: { type: String, required: true },
					path: { type: Schema.Types.Mixed, default: null }, // string | string[] | null
				},
			],
			immutable: true,
			required: true,
		},
		pageUrls: {
			type: [String],
			required: true,
		},
		actions: {
			type: [String],
			default: [],
		},
	},
	{ timestamps: true },
);

formSchema.statics.findByHash = async function (
	this: FormModelWithStatics,
	formHash: string,
) {
	return this.findOne({ formHash });
};

export type { FormDocument } from "./formField.types.js";

export const FormModel = model<TForm, FormModel>(FORM_MODEL_NAME, formSchema);
