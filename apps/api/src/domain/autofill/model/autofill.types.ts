import type { FormFieldPath, InferenceHint } from "@lazyapply/types";
import type { HydratedDocument, Model, Types } from "mongoose";

export const AUTOFILL_MODEL_NAME = "autofill" as const;

/** Field hash type - unique identifier for form fields */
export type FieldHash = string;

/**
 * Base autofill data item - common fields for all types
 * Stores all data needed for AutofillResponseItem so cached responses match first-time responses
 */
type AutofillDataItemBase = {
	/** Hash of the field this entry corresponds to */
	hash: FieldHash;
	/** Reference to the FormField collection */
	fieldRef: Types.ObjectId;
	/** Field name for display */
	fieldName: string;
	/** Field label from DOM */
	label: string | null;
	/** Classification path in ParsedCVData structure */
	path: FormFieldPath;
	/** Whether the path exists in ParsedCVData (vs inferred paths like motivation_text) */
	pathFound: boolean;
	/** For "links" classification, the detected link type */
	linkType?: string;
	/** Inference hint for fields requiring JD + CV generation (only when path is "unknown") */
	inferenceHint?: InferenceHint;
};

/**
 * Text field autofill data item
 */
export type AutofillDataItemText = AutofillDataItemBase & {
	/** The value (stored from CV or inferred) */
	value: string | null;
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
	/** MongoDB document ID */
	_id: Types.ObjectId;
	/** User who triggered this autofill */
	userId: string;
	/** Unique ID for this autofill request */
	autofillId: string;
	/** Reference to the Form collection */
	formReference: Types.ObjectId;
	/** Reference to the FileUpload collection (CV used) */
	uploadReference: Types.ObjectId;
	/** Reference to the CVData collection */
	cvDataReference: Types.ObjectId;
	/** Autofill results stored as entries keyed by field hash */
	data: AutofillDataItem[];
	/** Job description raw text */
	jdRawText: string;
	/** Job description URL */
	jdUrl: string;
	/** Form context information */
	formContext: string;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateAutofillParams = Omit<
	TAutofill,
	"_id" | "createdAt" | "updatedAt"
>;

export type AutofillMethods = Record<string, never>;

export type AutofillStatics = {
	findByAutofillId(
		this: AutofillModelWithStatics,
		autofillId: string,
		userId: string,
	): Promise<TAutofill | null>;
	/** Find the most recent autofill by userId, uploadId, and formId */
	findMostRecentByUserUploadForm(
		this: AutofillModelWithStatics,
		userId: string,
		uploadId: string,
		formId: string,
	): Promise<TAutofill | null>;
};

export type AutofillDocument = HydratedDocument<TAutofill, AutofillMethods>;

export type AutofillModelBase = Model<
	TAutofill,
	Record<string, never>,
	AutofillMethods
>;

export type AutofillModelWithStatics = AutofillModelBase & AutofillStatics;
