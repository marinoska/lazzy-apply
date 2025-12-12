import type {
	ClassificationFieldData,
	FormFieldPath,
	FormFieldRef,
	InferenceHint,
} from "@lazyapply/types";
import type { Document, Model } from "mongoose";

export const FORM_FIELD_MODEL_NAME = "form_fields" as const;
export const FORM_MODEL_NAME = "forms" as const;

/**
 * Stored field document structure
 * Only stores data needed for classification (no id, path is separate)
 */
export type TFormField = {
	hash: string;
	/** Classification-relevant field data (immutable) */
	field: ClassificationFieldData;
	classification: FormFieldPath;
	linkType?: string;
	/** Inference hint for fields requiring JD + CV generation (only when classification is "unknown") */
	inferenceHint?: InferenceHint;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateFormFieldParams = Omit<TFormField, "createdAt" | "updatedAt">;

export type FormFieldMethods = Record<string, never>;

export type FormFieldStatics = {
	findByHash(
		this: FormFieldModelWithStatics,
		hash: string,
	): Promise<FormFieldDocument | null>;
	findByHashes(
		this: FormFieldModelWithStatics,
		hashes: string[],
	): Promise<TFormField[]>;
};

export type FormFieldDocument = Document & TFormField & FormFieldMethods;

export type FormFieldModelBase = Model<
	TFormField,
	Record<string, never>,
	FormFieldMethods
>;

export type FormFieldModelWithStatics = FormFieldModelBase & FormFieldStatics;

/**
 * Stored form document structure
 */
export type TForm = {
	formHash: string;
	fields: FormFieldRef[];
	pageUrls: string[];
	actions: string[];
	createdAt: Date;
	updatedAt: Date;
};

export type CreateFormParams = Omit<TForm, "createdAt" | "updatedAt">;

export type FormMethods = Record<string, never>;

export type FormStatics = {
	findByHash(
		this: FormModelWithStatics,
		formHash: string,
	): Promise<FormDocument | null>;
};

export type FormDocument = Document & TForm & FormMethods;

export type FormModelBase = Model<TForm, Record<string, never>, FormMethods>;

export type FormModelWithStatics = FormModelBase & FormStatics;
