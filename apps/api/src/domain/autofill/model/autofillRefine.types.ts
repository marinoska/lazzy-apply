import type { HydratedDocument, Model } from "mongoose";
import type { FieldHash } from "./autofill.types.js";

export const AUTOFILL_REFINE_MODEL_NAME = "autofill_refines" as const;

export type TAutofillRefine = {
	autofillId: string;
	hash: FieldHash;
	value: string | null;
	fieldLabel: string;
	fieldDescription?: string;
	prevFieldText: string;
	userInstructions: string;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateAutofillRefineParams = Omit<
	TAutofillRefine,
	"createdAt" | "updatedAt"
>;

export type AutofillRefineMethods = Record<string, never>;

export type AutofillRefineStatics = {
	findByAutofillId(
		this: AutofillRefineModelWithStatics,
		autofillId: string,
	): Promise<TAutofillRefine[]>;
};

export type AutofillRefineDocument = HydratedDocument<
	TAutofillRefine,
	AutofillRefineMethods
>;

export type AutofillRefineModelBase = Model<
	TAutofillRefine,
	Record<string, never>,
	AutofillRefineMethods
>;

export type AutofillRefineModelWithStatics = AutofillRefineModelBase &
	AutofillRefineStatics;
