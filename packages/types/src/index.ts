// Shared TypeScript types for LazyApply

export * from "./constants.js";

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
export interface ParsedCVData {
	personal: {
		fullName: string | null;
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
	experience: Array<{
		role: string | null;
		company: string | null;
		startDate: string | null;
		endDate: string | null;
		description: string | null;
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
 * Form field classification paths matching ParsedCVData structure.
 * For links, the LLM determines the link type dynamically.
 */
export const FORM_FIELD_PATHS = [
	// Personal info
	"personal.fullName",
	"personal.email",
	"personal.phone",
	"personal.location",
	"personal.nationality",
	"personal.rightToWork",
	// Links - type is determined by LLM (linkedin, github, portfolio, behance, etc.)
	"links",
	// Headline
	"headline",
	// Summary
	"summary",
	// Experience
	"experience",
	// Education
	"education",
	// Certifications
	"certifications",
	// Languages
	"languages",
	// Extras
	"extras.drivingLicense",
	"extras.workPermit",
	"extras.willingToRelocate",
	"extras.remotePreference",
	"extras.noticePeriod",
	"extras.availability",
	"extras.salaryExpectation",
	// Special fields (not in ParsedCVData but needed for forms)
	"resume_upload",
	"cover_letter",
	"motivation_text",
	// Fallback
	"unknown",
] as const;

export type FormFieldPath = (typeof FORM_FIELD_PATHS)[number];

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
 */
export interface FieldData extends ClassificationFieldData {
	id: string;
}

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
}

/**
 * Form collection document - stored per unique form hash
 */
export interface Form {
	/** Unique form hash */
	formHash: string;
	/** Array of field references with hash and path(s) */
	fields: FormFieldRef[];
	/** Page URLs where the form was detected */
	pageUrls: string[];
	/** Form action URLs (if available) */
	actions: string[];
}

/**
 * Form field input for classification (legacy, kept for compatibility)
 */
export interface FormFieldInput {
	hash: string;
	id: string;
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
 */
export interface FormInput {
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
 * Autofill request payload with form and fields
 */
export interface AutofillRequest {
	form: FormInput;
	fields: Field[];
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
}

/**
 * Autofill response item returned to the client (keyed by field hash)
 */
export interface AutofillResponseItem {
	/** Original field ID from DOM */
	fieldId: string;
	/** Original field name from DOM */
	fieldName: string | null;
	/** Classification path in ParsedCVData structure */
	path: FormFieldPath;
	/** For "links" classification, the detected link type */
	linkType?: string;
}

/**
 * Autofill response returned to the client
 * Record keyed by field hash
 */
export type AutofillResponse = Record<string, AutofillResponseItem>;

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
}

/**
 * Stored form document in the database
 */
export interface StoredForm {
	/** Unique form hash */
	formHash: string;
	/** Array of field references with hash and path(s) */
	fields: FormFieldRef[];
	/** Page URLs where the form was detected */
	pageUrls: string[];
	/** Form action URLs (if available) */
	actions: string[];
}

// Add more shared types here
