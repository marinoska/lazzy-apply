import type { Types } from "mongoose";

// Shared TypeScript types for LazyApply

export * from "./constants.js";

/**
 * File upload status values
 */
export const FILE_UPLOAD_STATUSES = [
	"pending",
	"uploaded",
	"failed",
	"rejected",
	"deduplicated",
	"deleted-by-user",
] as const;

/**
 * File upload status type
 */
export type FileUploadStatus = (typeof FILE_UPLOAD_STATUSES)[number];

/**
 * Parse status values (from outbox processing)
 */
export const UNFINISHED_PARSE_STATUSES = [
	"pending",
	"sending",
	"processing",
] as const;

export const SUCCESS_AND_UNFINISHED_PARSE_STATUSES = [
	...UNFINISHED_PARSE_STATUSES,
	"completed",
] as const;

export const TERMINAL_PARSE_STATUSES = [
	"completed",
	"failed",
	"not-a-cv",
] as const;

export const PARSE_STATUSES = [
	...UNFINISHED_PARSE_STATUSES,
	...TERMINAL_PARSE_STATUSES,
] as const;

/**
 * Parse status type
 */
export type ParseStatus = (typeof PARSE_STATUSES)[number];

/**
 * File upload content type values
 */
export const FILE_UPLOAD_CONTENT_TYPES = ["PDF", "DOCX"] as const;

/**
 * File upload content type
 */
export type FileUploadContentType = (typeof FILE_UPLOAD_CONTENT_TYPES)[number];

export interface User {
	id: string;
	email: string;
	created_at: string;
}

export interface JobApplication {
	id: string;
	user_id: string;
	job_title: string;
	company: string;
	status: "pending" | "applied" | "rejected" | "interview";
	created_at: string;
	updated_at: string;
}

/**
 * Message structure for the parse-cv queue
 * Must match the producer message structure
 */
export interface ParseCVQueueMessage {
	uploadId: string; // MongoDB _id from file_uploads
	fileId: string; // R2 storage filename
	processId: string;
	userId: string;
	fileType: FileUploadContentType;
}

/**
 * Parsed CV data structure
 * Returned by the worker after processing a CV file
 */
export interface ParsedCVData<T extends Types.ObjectId | string = string> {
	_id: T;
	personal: {
		fullName: string | null;
		firstName?: string | null;
		lastName?: string | null;
		email: string | null;
		phone: string | null;
		location: string | null;
		nationality?: string | null;
		rightToWork?: string | null;
	};
	links: Array<{
		type: string; // "linkedin", "github", "portfolio", "behance", "other"
		url: string;
	}>;
	headline: string | null;
	summary: string | null;
	summaryFacts: string[];
	profileSignals: Record<string, string>;
	experience: Array<{
		role: string | null;
		company: string | null;
		startDate: string | null;
		endDate: string | null;
		description: string | null;
		experienceFacts: string[];
	}>;
	education: Array<{
		degree: string | null;
		field: string | null;
		institution: string | null;
		startDate?: string | null;
		endDate?: string | null;
	}>;
	certifications: Array<{
		name: string;
		issuer?: string | null;
		date?: string | null;
	}>;
	languages: Array<{
		language: string;
		level?: string | null;
	}>;
	extras: {
		drivingLicense?: string | null;
		workPermit?: string | null;
		willingToRelocate?: boolean | null;
		remotePreference?: string | null;
		noticePeriod?: string | null;
		availability?: string | null;
		salaryExpectation?: string | null;
	};
	rawText: string;
}

/**
 * Token usage from AI processing
 */
export type TokenUsage = {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	/** Estimated cost breakdown in USD */
	inputCost?: number;
	outputCost?: number;
	totalCost?: number;
};

/**
 * CV Data paths with descriptions - single source of truth
 * These paths exist in ParsedCVData and can be auto-filled from CV
 */
export const CV_DATA_PATH_MAP = {
	"personal.fullName": "Full name field",
	"personal.firstName": "First name field",
	"personal.lastName": "Last name / surname / family name field",
	"personal.email": "Email address",
	"personal.phone": "Phone number",
	"personal.location": "City, address, or location",
	"personal.nationality": "Nationality or citizenship",
	"personal.rightToWork": "Right to work / visa status",
	links: "Any URL/link field (LinkedIn, GitHub, portfolio, website, etc.)",
	headline: "Professional headline/title (e.g., 'Senior Software Engineer')",
	summary: "Professional summary, about me, bio",
	experience: "Work experience, job history, responsibilities",
	education: "Education, degrees, schools",
	certifications: "Certifications, licenses, courses",
	languages: "Language skills",
	"extras.drivingLicense": "Driving license",
	"extras.workPermit": "Work permit",
	"extras.willingToRelocate": "Relocation willingness",
	"extras.remotePreference": "Remote work preference",
	"extras.noticePeriod": "Notice period",
	"extras.availability": "Start date, availability",
	"extras.salaryExpectation": "Salary expectation",
} as const;

export type CVDataPath = keyof typeof CV_DATA_PATH_MAP;

/** Array of CV data paths for iteration */
export const CV_DATA_PATHS = Object.keys(CV_DATA_PATH_MAP) as CVDataPath[];

/**
 * Inferred paths with descriptions - not in ParsedCVData, require user input
 */
export const INFERRED_PATH_MAP = {
	resume_upload: "CV/Resume file upload",
	cover_letter: "Cover letter text or upload",
	motivation_text: "Motivation letter, why us, why you",
	unknown: "Cannot determine",
} as const;

/**
 * Inference hints for fields that require JD + CV generation
 * Used when path is "unknown" but the field can be answered via inference
 */
export const INFERENCE_HINTS = ["text_from_jd_cv"] as const;

export type InferenceHint = (typeof INFERENCE_HINTS)[number];

export type InferredPath = keyof typeof INFERRED_PATH_MAP;

/** Array of inferred paths for iteration */
export const INFERRED_PATHS = Object.keys(INFERRED_PATH_MAP) as InferredPath[];

/**
 * All form field paths (CV data + inferred)
 */
export const FORM_FIELD_PATH_MAP = {
	...CV_DATA_PATH_MAP,
	...INFERRED_PATH_MAP,
} as const;

export type FormFieldPath = keyof typeof FORM_FIELD_PATH_MAP;

/** Array of all form field paths for iteration */
export const FORM_FIELD_PATHS = Object.keys(
	FORM_FIELD_PATH_MAP,
) as FormFieldPath[];

/**
 * Field data used for classification (stored in DB)
 * Does not include id or path - only data needed for AI classification
 */
export interface ClassificationFieldData {
	tag: string;
	type: string;
	name: string | null;
	label: string | null;
	placeholder: string | null;
	description: string | null;
	isFileUpload: boolean;
	accept: string | null;
}

/**
 * Field data object containing all field metadata
 * Note: id was removed as name is the reliable identifier for form fields
 */
export type FieldData = ClassificationFieldData;

/**
 * Field collection document - stored per unique field hash
 */
export interface Field {
	/** Unique field hash */
	hash: string;
	/** Field metadata */
	field: FieldData;
}

/**
 * Form field reference with hash and path(s)
 */
export interface FormFieldRef {
	/** Field hash */
	hash: string;
	/** Classification path in ParsedCVData structure */
	classification: FormFieldPath;
	/** Link type for the field (e.g., LinkedIn, GitHub) */
	linkType?: string;
	/** Inference hint for fields requiring JD + CV generation (only when classification is "unknown") */
	inferenceHint?: InferenceHint;
}

/**
 * Form field reference input - hash only (classification is determined by API)
 */
export interface FormFieldRefInput {
	/** Field hash */
	hash: string;
}

/**
 * Form collection document - stored per unique form hash
 */
export interface Form {
	/** Unique form hash */
	formHash: string;
	/** Array of field references with hash and path(s) */
	fields: FormFieldRef[];
	/** Page URL where the form was detected */
	pageUrl: string;
	/** Form action URL (if available) */
	action: string | null;
}

/**
 * Form field input for classification
 */
export interface FormFieldInput {
	hash: string;
	tag: string;
	type: string;
	name: string | null;
	label: string | null;
	placeholder: string | null;
	description: string | null;
	isFileUpload: boolean;
	accept: string | null;
}

/**
 * Form input from client (single pageUrl/action)
 * Note: `fields` contains only hashes (FormFieldRefInput[]), not full field data.
 */
export interface FormInput {
	/** Unique form hash */
	formHash: string;
	/** Array of field references with hash only (classification is determined by API) */
	fields: FormFieldRefInput[];
	/** Page URL where the form was detected */
	pageUrl: string;
	/** Form action URL (if available) */
	action: string | null;
}

/**
 * Form input with full field refs (for storage/retrieval)
 */
export interface FormInputWithClassification {
	/** Unique form hash */
	formHash: string;
	/** Array of field references with hash and classification */
	fields: FormFieldRef[];
	/** Page URL where the form was detected */
	pageUrl: string;
	/** Form action URL (if available) */
	action: string | null;
}

/**
 * Text block extracted from the page (headers, paragraphs)
 */
export interface FormContextBlock {
	text: string;
	type: string;
}

/**
 * Autofill request payload with form and fields
 * Note: `form.fields` contains only hashes (FormFieldRefInput[]),
 * while `fields` contains full field metadata (Field[]).
 */
export interface AutofillRequest {
	/** Form structure with field hashes only */
	form: FormInput;
	/** Full field metadata array (hash + FieldData) */
	fields: Field[];
	/** Selected upload ID to use for CV data lookup */
	selectedUploadId: string;
	/** Raw job description text for inference (optional) */
	jdRawText?: string;
	/** URL where the JD was extracted from (optional) */
	jdUrl?: string;
	/** Text extracted from the form page (headers, descriptions, etc.) */
	formContext?: string;
	/** Optional autofillId to retrieve existing autofill data */
	autofillId?: string;
}

/**
 * Form field classification result.
 * If a field accepts multiple types, multiple entries with the same hash are returned.
 */
export interface ClassifiedField {
	hash: string;
	/** Path in ParsedCVData structure */
	classification: FormFieldPath;
	/** For "links" path, the detected link type */
	linkType?: string;
	/** Inference hint for fields requiring JD + CV generation (only when classification is "unknown") */
	inferenceHint?: InferenceHint;
}

/**
 * Autofill response item returned to the client (keyed by field hash)
 */
export interface AutofillResponseItem {
	/** Original field name from DOM */
	fieldName: string | null;
	/** Field label from DOM */
	label: string | null;
	/** Classification path in ParsedCVData structure */
	path: FormFieldPath;
	/** For "links" classification, the detected link type */
	linkType?: string;
	/** Inference hint for fields requiring JD + CV generation (only when path is "unknown") */
	inferenceHint?: InferenceHint;
	/** Whether the path exists in ParsedCVData (vs inferred paths like motivation_text) */
	pathFound: boolean;
	/** The actual value from CV data if pathFound is true */
	value?: string | null;
	/** Presigned URL for file download (for resume_upload fields) */
	fileUrl?: string;
	/** Original filename for file uploads */
	fileName?: string;
	/** Content type for file uploads (e.g., "PDF", "DOCX") */
	fileContentType?: string;
}

/**
 * Autofill response data - Record keyed by field hash
 */
export type AutofillResponseData = Record<string, AutofillResponseItem>;

/**
 * Cover letter data for a specific field
 */
export interface CoverLetterData {
	hash: string;
	value: string;
	length: string;
	format: string;
}

/**
 * Autofill response returned to the client
 * Contains autofillId and field data
 */
export interface AutofillResponse {
	/** Unique ID for this autofill request */
	autofillId: string;
	/** Field data keyed by field hash */
	fields: AutofillResponseData;
	/** Whether the response was served from cache */
	fromCache: boolean;
	/** Cover letter data if available */
	coverLetter?: CoverLetterData;
}

/**
 * Stored field document in the database
 */
export interface StoredField {
	/** Unique field hash */
	hash: string;
	/** Field metadata */
	field: FieldData;
	/** Classification path in ParsedCVData structure */
	classification: FormFieldPath;
	/** For "links" classification, the detected link type */
	linkType?: string;
	/** Inference hint for fields requiring JD + CV generation (only when classification is "unknown") */
	inferenceHint?: InferenceHint;
}

/**
 * Stored form document in the database
 */
export interface StoredForm {
	/** Unique form hash */
	formHash: string;
	/** Array of field references with hash and path(s) */
	fields: FormFieldRef[];
	/** Page URL where the form was detected */
	pageUrl: string;
	/** Form action URL (if available) */
	action: string | null;
}

/**
 * Cover letter generation settings
 */
export const COVER_LETTER_LENGTHS = ["short", "medium", "detailed"] as const;
export const COVER_LETTER_TONES = [
	"professional",
	"warm",
	"confident",
	"friendly",
] as const;
export const COVER_LETTER_FORMATS = ["paragraph", "bullet"] as const;
export const COVER_LETTER_LANGUAGES = [
	"simple",
	"neutral",
	"advanced",
] as const;
export const COVER_LETTER_CTAS = ["none", "minimal", "strong"] as const;
export const COVER_LETTER_STYLES = [
	"to the point",
	"energetic",
	"story-like",
	"calm",
	"formal",
	"casual",
] as const;

export type CoverLetterLength = (typeof COVER_LETTER_LENGTHS)[number];
export type CoverLetterTone = (typeof COVER_LETTER_TONES)[number];
export type CoverLetterFormat = (typeof COVER_LETTER_FORMATS)[number];
export type CoverLetterLanguage = (typeof COVER_LETTER_LANGUAGES)[number];
export type CoverLetterCTA = (typeof COVER_LETTER_CTAS)[number];
export type CoverLetterStyle = (typeof COVER_LETTER_STYLES)[number];

export interface CoverLetterSettings {
	length: CoverLetterLength;
	format: CoverLetterFormat;
}

// Add more shared types here
