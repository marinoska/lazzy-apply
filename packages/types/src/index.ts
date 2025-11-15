// Shared TypeScript types for LazyApply

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
	fileId: string;
	logId: string;
	userId: string;
}

/**
 * Parsed CV data structure
 * Returned by the worker after processing a CV file
 */
export interface ParsedCVData {
	fileId: string;
	personalInfo: {
		name?: string;
		email?: string;
		phone?: string;
		location?: string;
		linkedIn?: string;
		github?: string;
		website?: string;
	};
	summary?: string;
	skills: string[];
	experience: WorkExperience[];
	education: Education[];
	certifications?: Certification[];
	languages?: Language[];
	rawText?: string; // Full extracted text for reference
}

export interface WorkExperience {
	company: string;
	position: string;
	location?: string;
	startDate?: string;
	endDate?: string;
	current?: boolean;
	description?: string;
	achievements?: string[];
}

export interface Education {
	institution: string;
	degree?: string;
	field?: string;
	location?: string;
	startDate?: string;
	endDate?: string;
	gpa?: string;
}

export interface Certification {
	name: string;
	issuer?: string;
	date?: string;
	expiryDate?: string;
	credentialId?: string;
}

export interface Language {
	name: string;
	proficiency?: "native" | "fluent" | "professional" | "intermediate" | "basic";
}

// Add more shared types here
