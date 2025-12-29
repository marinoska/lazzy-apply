import type { HydratedDocument, Model } from "mongoose";
import type { FieldHash } from "./autofill.types.js";

export const AUTOFILL_COVER_LETTER_MODEL_NAME =
	"autofill_cover_letters" as const;

export type TAutofillCoverLetter = {
	userId: string;
	autofillId: string;
	hash: FieldHash;
	value: string;
	instructions: string;
	length: string;
	format: string;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateAutofillCoverLetterParams = Omit<
	TAutofillCoverLetter,
	"createdAt" | "updatedAt"
>;

export type AutofillCoverLetterMethods = Record<string, never>;

export type AutofillCoverLetterStatics = {
	findByAutofillId(
		this: AutofillCoverLetterModelWithStatics,
		autofillId: string,
		userId?: string,
	): Promise<TAutofillCoverLetter | null>;
};

export type AutofillCoverLetterDocument = HydratedDocument<
	TAutofillCoverLetter,
	AutofillCoverLetterMethods
>;

export type AutofillCoverLetterModelBase = Model<
	TAutofillCoverLetter,
	Record<string, never>,
	AutofillCoverLetterMethods
>;

export type AutofillCoverLetterModelWithStatics = AutofillCoverLetterModelBase &
	AutofillCoverLetterStatics;
