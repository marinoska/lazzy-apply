import type { Document, Model, Types } from "mongoose";

export const AUTOFILL_MODEL_NAME = "autofill" as const;

/** Field hash type - unique identifier for form fields */
export type FieldHash = string;

/**
 * Base autofill data item - common fields for all types
 */
type AutofillDataItemBase = {
	/** Hash of the field this entry corresponds to */
	hash: FieldHash;
	/** Reference to the FormField collection */
	fieldRef: Types.ObjectId;
	/** Field name for display */
	fieldName: string;
};

/**
 * Text field autofill data item
 */
export type AutofillDataItemText = AutofillDataItemBase & {
	/** The value (stored from CV or inferred) */
	value: string;
	fileUrl?: never;
	fileName?: never;
	fileContentType?: never;
};

/**
 * File upload autofill data item
 */
export type AutofillDataItemFile = AutofillDataItemBase & {
	/** Presigned URL for file download */
	fileUrl: string;
	/** Original filename */
	fileName: string;
	/** Content type (e.g., "PDF", "DOCX") */
	fileContentType: string;
	value?: never;
};

/**
 * Autofill data item - stores the result for a single field
 * Can be either a text value or file upload
 */
export type AutofillDataItem = AutofillDataItemText | AutofillDataItemFile;

/**
 * Stored autofill document structure
 * Records each autofill request with its results
 */
export type TAutofill = {
	/** User who triggered this autofill */
	userId: string;
	/** Unique ID for this autofill request */
	autofillId: string;
	/** Reference to the Form collection */
	formReference: Types.ObjectId;
	/** Reference to the FileUpload collection (CV used) */
	uploadReference: Types.ObjectId;
	/** Autofill results stored as entries keyed by field hash */
	data: AutofillDataItem[];
	createdAt: Date;
	updatedAt: Date;
};

export type CreateAutofillParams = Omit<TAutofill, "createdAt" | "updatedAt">;

export type AutofillMethods = Record<string, never>;

export type AutofillStatics = {
	createAutofill(
		this: AutofillModelWithStatics,
		params: CreateAutofillParams,
	): Promise<AutofillDocument>;
	findByAutofillId(
		this: AutofillModelWithStatics,
		autofillId: string,
	): Promise<AutofillDocument | null>;
	findByUserId(
		this: AutofillModelWithStatics,
		userId: string,
	): Promise<TAutofill[]>;
};

export type AutofillDocument = Document & TAutofill & AutofillMethods;

export type AutofillModelBase = Model<
	TAutofill,
	Record<string, never>,
	AutofillMethods
>;

export type AutofillModelWithStatics = AutofillModelBase & AutofillStatics;
