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
};

// Add more shared types here
