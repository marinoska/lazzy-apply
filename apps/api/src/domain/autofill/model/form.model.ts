import { model, Schema } from "mongoose";
import {
	type FindByHashOptions,
	FORM_FIELD_MODEL_NAME,
	FORM_MODEL_NAME,
	type FormDocumentPopulated,
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
					classification: { type: String, required: true },
					linkType: { type: String, default: undefined },
					fieldRef: {
						type: Schema.Types.ObjectId,
						ref: FORM_FIELD_MODEL_NAME,
						required: true,
					},
				},
			],
			immutable: true,
			required: true,
		},
		pageUrl: {
			type: String,
			required: true,
		},
		action: {
			type: String,
			default: null,
		},
	},
	{ timestamps: true },
);

formSchema.statics.findByHash = async function (
	this: FormModelWithStatics,
	formHash: string,
	options?: FindByHashOptions,
): Promise<FormDocumentPopulated | null> {
	const query = this.findOne({ formHash });
	if (options?.populate) {
		query.populate("fields.fieldRef");
	}
	const result = await query.exec();
	return result as FormDocumentPopulated | null;
};

export type { FormDocument } from "./formField.types.js";

export const FormModel = model<TForm, FormModel>(FORM_MODEL_NAME, formSchema);
