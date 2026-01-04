import { model, Schema } from "mongoose";
import { applyOwnershipEnforcement } from "@/app/middleware/mongoOwnershipEnforcement.middleware.js";
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
		userId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
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
	userId?: string,
) {
	const query = this.findOne({ autofillId }).sort({ createdAt: -1 });
	if (userId) {
		query.setOptions({ userId });
	}
	const result = await query.lean();

	return result;
};

applyOwnershipEnforcement(autofillCoverLetterSchema);

export type { AutofillCoverLetterDocument } from "./autofillCoverLetter.types.js";
export { AUTOFILL_COVER_LETTER_MODEL_NAME } from "./autofillCoverLetter.types.js";

export const AutofillCoverLetterModel = model<
	TAutofillCoverLetter,
	AutofillCoverLetterModel
>(AUTOFILL_COVER_LETTER_MODEL_NAME, autofillCoverLetterSchema);
