import { model, Schema } from "mongoose";
import {
	AUTOFILL_COVER_LETTER_MODEL_NAME,
	type AutofillCoverLetterMethods,
	type AutofillCoverLetterModelWithStatics,
	type TAutofillCoverLetter,
} from "./autofillCoverLetter.types.js";

export type AutofillCoverLetterModel = AutofillCoverLetterModelWithStatics;

const autofillCoverLetterSchema = new Schema<
	TAutofillCoverLetter,
	AutofillCoverLetterModel,
	AutofillCoverLetterMethods
>(
	{
		autofillId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		hash: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		value: {
			type: String,
			required: true,
		},
		instructions: {
			type: String,
			default: "",
		},
		length: {
			type: String,
			required: true,
		},
		format: {
			type: String,
			required: true,
		},
	},
	{ timestamps: true, collection: AUTOFILL_COVER_LETTER_MODEL_NAME },
);

autofillCoverLetterSchema.index({ autofillId: 1, createdAt: -1 });

/**
 * Finds the latest cover letter for a given autofillId.
 * Returns the most recent record or null.
 */
autofillCoverLetterSchema.statics.findByAutofillId = async function (
	this: AutofillCoverLetterModelWithStatics,
	autofillId: string,
) {
	const result = await this.findOne({ autofillId })
		.sort({ createdAt: -1 })
		.lean();

	return result;
};

export type { AutofillCoverLetterDocument } from "./autofillCoverLetter.types.js";

export const AutofillCoverLetterModel = model<
	TAutofillCoverLetter,
	AutofillCoverLetterModel
>(AUTOFILL_COVER_LETTER_MODEL_NAME, autofillCoverLetterSchema);
