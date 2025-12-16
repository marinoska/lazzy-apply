// Shared Zod schemas for validation across LazyApply

import { z } from "zod";

export const userSchema = z.object({
	id: z.string().uuid(),
	email: z.string().email(),
	created_at: z.string().datetime(),
});

export const jobApplicationSchema = z.object({
	id: z.string().uuid(),
	user_id: z.string().uuid(),
	job_title: z.string().min(1),
	company: z.string().min(1),
	status: z.enum(["pending", "applied", "rejected", "interview"]),
	created_at: z.string().datetime(),
	updated_at: z.string().datetime(),
});

/**
 * Field data schema - metadata for a form field
 * Note: id was removed as name is the reliable identifier for form fields
 */
export const fieldDataSchema = z.object({
	tag: z.string(),
	type: z.string(),
	name: z.string().nullable(),
	label: z.string().nullable(),
	placeholder: z.string().nullable(),
	description: z.string().nullable(),
	isFileUpload: z.boolean(),
	accept: z.string().nullable(),
});

/**
 * Field collection schema - stored per unique field hash
 */
export const fieldSchema = z.object({
	hash: z.string().min(1),
	field: fieldDataSchema,
});

/**
 * Form field reference schema - hash and classification
 */
export const formFieldRefSchema = z.object({
	hash: z.string().min(1),
	classification: z.string().min(1),
	linkType: z.string().optional(),
});

/**
 * Form field reference input schema - hash only (classification is determined by API)
 */
export const formFieldRefInputSchema = z.object({
	hash: z.string().min(1),
});

/**
 * Form input schema - from client (single pageUrl/action)
 */
export const formInputSchema = z.object({
	formHash: z.string().min(1),
	fields: z.array(formFieldRefInputSchema).min(1),
	pageUrl: z.string().url(),
	action: z.string().nullable(),
});

/**
 * Form collection schema - stored per unique form hash (arrays for pageUrls/actions)
 */
export const formSchema = z.object({
	formHash: z.string().min(1),
	fields: z.array(formFieldRefSchema).min(1),
	pageUrls: z.array(z.string().url()).min(1),
	actions: z.array(z.string()),
});

/**
 * Form input schema with full field refs (for storage/retrieval)
 */
export const formInputWithClassificationSchema = z.object({
	formHash: z.string().min(1),
	fields: z.array(formFieldRefSchema).min(1),
	pageUrl: z.string().url(),
	action: z.string().nullable(),
});

/**
 * Form context block schema (text blocks from the form page)
 */
export const formContextBlockSchema = z.object({
	text: z.string(),
	type: z.string(),
});

/**
 * Autofill request schema
 */
export const autofillRequestSchema = z.object({
	form: formInputSchema,
	fields: z.array(fieldSchema).min(1),
	selectedUploadId: z.string().min(1),
	jdRawText: z.string().optional(),
	jdUrl: z.string().url().optional(),
	formContext: z.array(formContextBlockSchema).optional(),
});

/**
 * Autofill response item schema
 */
export const autofillResponseItemSchema = z.object({
	fieldName: z.string().nullable(),
	path: z.string(),
	linkType: z.string().optional(),
	pathFound: z.boolean(),
	value: z.string().nullable().optional(),
});

/**
 * Autofill response schema - Record keyed by field hash
 */
export const autofillResponseSchema = z.record(
	z.string(),
	autofillResponseItemSchema,
);

// Add more shared schemas here
