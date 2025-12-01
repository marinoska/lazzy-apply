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
 * Form field input for classification
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
 * Form field classification result.
 * If a field accepts multiple types, multiple entries with the same hash are returned.
 */
export interface FormFieldClassification {
	hash: string;
	/** Path in ParsedCVData structure */
	path: FormFieldPath;
	/** For "links" path, the detected link type */
	linkType?: string;
}

// Add more shared types here
