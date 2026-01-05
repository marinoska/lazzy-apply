import { createOpenAI } from "@ai-sdk/openai";
import type { ParsedCVData, TokenUsage } from "@lazyapply/types";
import { generateObject, zodSchema } from "ai";
import * as z from "zod";
import type { Env } from "../types";

/**
 * Safely get an environment variable
 */
function getEnv<K extends keyof Env>(env: Env, key: K): Env[K] {
	const value = env[key];
	if (value === undefined || value === null || value === "") {
		throw new Error(
			`Environment variable ${String(key)} is required but not set`,
		);
	}
	return value;
}

/**
 * Get AI model configuration from environment
 */
function getAIModelConfig(env: Env) {
	const modelName = getEnv(env, "AI_MODEL_NAME");
	const inputPriceStr = getEnv(env, "AI_MODEL_INPUT_PRICE_PER_1M");
	const outputPriceStr = getEnv(env, "AI_MODEL_OUTPUT_PRICE_PER_1M");

	const inputPricePer1M = Number.parseFloat(inputPriceStr);
	const outputPricePer1M = Number.parseFloat(outputPriceStr);

	if (Number.isNaN(inputPricePer1M)) {
		throw new Error(`Invalid AI_MODEL_INPUT_PRICE_PER_1M: ${inputPriceStr}`);
	}

	if (Number.isNaN(outputPricePer1M)) {
		throw new Error(`Invalid AI_MODEL_OUTPUT_PRICE_PER_1M: ${outputPriceStr}`);
	}

	return { modelName, inputPricePer1M, outputPricePer1M };
}

// Single unified schema that works with OpenAI structured outputs
// OpenAI requires root-level object type, not union
const extractedCVDataSchema = z.object({
	parseStatus: z.enum(["completed", "not-a-cv"]),
	personal: z
		.object({
			fullName: z.string().nullable().optional(),
			firstName: z.string().nullable().optional(),
			lastName: z.string().nullable().optional(),
			email: z.string().nullable().optional(),
			phone: z.string().nullable().optional(),
			location: z.string().nullable().optional(),
			nationality: z.string().nullable().optional(),
			rightToWork: z.string().nullable().optional(),
		})
		.optional(),
	links: z
		.array(
			z.object({
				type: z.string(),
				url: z.string().nullable().optional(),
			}),
		)
		.optional()
		.default([]),
	headline: z.string().nullable().optional(),
	summary: z.string().nullable().optional(),
	summaryFacts: z.array(z.string()).optional().default([]),
	profileSignals: z.record(z.string(), z.string()).optional().default({}),
	experience: z
		.array(
			z.object({
				role: z.string().nullable().optional(),
				company: z.string().nullable().optional(),
				startDate: z.string().nullable().optional(),
				endDate: z.string().nullable().optional(),
				description: z.string().nullable().optional(),
				experienceFacts: z.array(z.string()).optional().default([]),
			}),
		)
		.optional()
		.default([]),
	education: z
		.array(
			z.object({
				degree: z.string().nullable().optional(),
				field: z.string().nullable().optional(),
				institution: z.string().nullable().optional(),
				startDate: z.string().nullable().optional(),
				endDate: z.string().nullable().optional(),
			}),
		)
		.optional()
		.default([]),
	certifications: z
		.array(
			z.object({
				name: z.string(),
				issuer: z.string().nullable().optional(),
				date: z.string().nullable().optional(),
			}),
		)
		.optional()
		.default([]),
	languages: z
		.array(
			z.object({
				language: z.string(),
				level: z.string().nullable().optional(),
			}),
		)
		.optional()
		.default([]),
	extras: z
		.object({
			drivingLicense: z.string().nullable().optional(),
			workPermit: z.string().nullable().optional(),
			willingToRelocate: z.boolean().nullable().optional(),
			remotePreference: z.string().nullable().optional(),
			noticePeriod: z.string().nullable().optional(),
			availability: z.string().nullable().optional(),
			salaryExpectation: z.string().nullable().optional(),
		})
		.optional(),
	rawText: z.string(),
});

// Infer type from schema
type ExtractedCVData = z.infer<typeof extractedCVDataSchema>;

// Type guard to check if response is not-a-cv
function isNotACV(data: ExtractedCVData): boolean {
	return data.parseStatus === "not-a-cv";
}

const EXTRACTION_PROMPT = `You are an information extraction engine.

STEP 1 — DOCUMENT CLASSIFICATION:
First, determine whether the input document is a CV/resume.
A CV/resume typically contains: personal contact information, work experience, education, skills, or professional summary.

If the document is NOT a CV/resume (e.g., a cover letter, invoice, article, random text, or any other document type), return:
{
  "parseStatus": "not-a-cv",
  "rawText": "<the full input text>"
}
Leave all other fields empty/null and stop. Do not proceed with extraction.

STEP 2 — CV EXTRACTION (only if document IS a CV/resume):
Extract structured data from the CV exactly following the JSON schema below.

IMPORTANT RULES:
- Do NOT hallucinate.
- Only extract information that is explicitly present in the CV.
- If any field is missing or unclear → return null for that field.
- Dates may remain in their original format.
- The "links" list must classify each link using best-fit category ("linkedin", "portfolio", "github", "behance", "dribbble", "twitter", "website", "other").
- Only extract a link when it contains a valid URL (must include http:// or https:// or a domain like ".com", ".io", ".net", etc.).
- If the text only mentions a platform name (e.g., "LinkedIn", "Github", "Portfolio") without an actual URL, do NOT return it as a link.
- "experience.description" must contain the full text of that job's responsibilities/achievements.
- Never invent degrees, skills, certifications, or experience.
- Return VALID JSON ONLY. No explanations. No comments. No markdown.

OUTPUT SCHEMA:

{
  "parseStatus": "completed",  // Use "completed" for valid CVs, "not-a-cv" for non-CV documents
  "personal": {
    "fullName": string | null,
    "firstName": string | null,  // First name / given name
    "lastName": string | null,   // Last name / surname / family name
    "email": string | null,
    "phone": string | null,
    "location": string | null,
    "nationality": string | null,
    "rightToWork": string | null
  },

  "links": [
    {
      "type": string,
      "url": string
    }
  ],

  "headline": string | null,  // Professional headline/title (e.g., "Senior Software Engineer", "Product Manager")

  "summary": string | null,

  "summaryFacts": string[],  // Array of short, atomic factual statements derived from BOTH headline and summary. Normalize headline information into factual statements (do NOT copy verbatim). Extract explicit signals like: role level (senior, lead), role scope (full-stack, backend), named technologies, work mode (remote, hybrid). Each fact must be directly stated in the source. Do NOT infer, interpret, or add information. Do NOT duplicate facts. Keep each fact atomic and concise. If no clear facts exist, return empty array.

  "profileSignals": Record<string, string>,  // Derived categorical signals for routing/decision-making. Derive ONLY from headline, summaryFacts, and experienceFacts. Each signal must be explainable by existing facts. Signals may generalize or categorize patterns (e.g., {"seniority": "senior", "role_scope": "full-stack", "tech_focus": "backend", "work_mode": "remote", "leadership": "present"}). Use short lowercase keys. Do NOT restate facts verbatim. Do NOT invent information. If uncertain, omit the signal. Return empty object if no clear signals exist.

  "experience": [
    {
      "role": string | null,
      "company": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "description": string | null,
      "experienceFacts": string[]  // Array of short, atomic factual statements derived ONLY from this experience's description. Each fact must be directly supported by the description text. Do NOT infer impact, metrics, or seniority unless explicitly stated. Keep each fact concise. If no clear facts exist, return empty array.
    }
  ],

  "education": [
    {
      "degree": string | null,
      "field": string | null,
      "institution": string | null,
      "startDate": string | null,
      "endDate": string | null
    }
  ],

  "certifications": [
    {
      "name": string,
      "issuer": string | null,
      "date": string | null
    }
  ],

  "languages": [
    {
      "language": string,
      "level": string | null
    }
  ],

  "extras": {
    "drivingLicense": string | null,
    "workPermit": string | null,
    "willingToRelocate": boolean | null,
    "remotePreference": string | null,
    "noticePeriod": string | null,
    "availability": string | null,
    "salaryExpectation": string | null
  },

  "rawText": string   // return the full input text here
}

NOW EXTRACT THE DATA.`;

type FinishReason =
	| "stop"
	| "length"
	| "content-filter"
	| "tool-calls"
	| "error"
	| "other"
	| "unknown";

export type ExtractCVDataSuccessResult = {
	parseStatus: "completed";
	parsedData: Omit<ParsedCVData, "_id">;
	usage: TokenUsage;
	finishReason: FinishReason;
};

export type ExtractCVDataNotACVResult = {
	parseStatus: "not-a-cv";
	rawText: string;
	usage: TokenUsage;
	finishReason: FinishReason;
};

export type ExtractCVDataResult =
	| ExtractCVDataSuccessResult
	| ExtractCVDataNotACVResult;

/**
 * Extract structured CV data from raw text using configured AI model
 */
export async function extractCVData(
	cvText: string,
	env: Env,
): Promise<ExtractCVDataResult> {
	try {
		// Get AI model configuration
		const { modelName, inputPricePer1M, outputPricePer1M } =
			getAIModelConfig(env);
		const apiKey = getEnv(env, "OPENAI_API_KEY");

		// Create OpenAI client with API key
		const openai = createOpenAI({
			apiKey,
		});

		const result = await generateObject({
			model: openai(modelName),
			schema: zodSchema(extractedCVDataSchema),
			prompt: `${EXTRACTION_PROMPT}\n\nCV TEXT:\n"""\n${cvText}\n"""`,
			temperature: 0,
		});

		// Extract and cast to our inferred type
		const extractedData = result.object as ExtractedCVData;

		const promptTokens = result.usage.inputTokens ?? 0;
		const completionTokens = result.usage.outputTokens ?? 0;
		const totalTokens = result.usage.totalTokens ?? 0;

		// Calculate cost breakdown using pricing from environment
		const inputCost = (promptTokens / 1_000_000) * inputPricePer1M;
		const outputCost = (completionTokens / 1_000_000) * outputPricePer1M;
		const totalCost = inputCost + outputCost;

		const usage: TokenUsage = {
			promptTokens,
			completionTokens,
			totalTokens,
			inputCost,
			outputCost,
			totalCost,
		};

		// Handle not-a-cv response
		if (isNotACV(extractedData)) {
			return {
				parseStatus: "not-a-cv",
				rawText: extractedData.rawText,
				usage,
				finishReason: result.finishReason,
			};
		}

		// At this point, extractedData is a full CV
		const cvData = extractedData;

		// Transform the extracted data to match ParsedCVData format
		const personal = cvData.personal ?? {};
		const links = cvData.links ?? [];
		const experience = cvData.experience ?? [];
		const education = cvData.education ?? [];
		const certifications = cvData.certifications ?? [];
		const languages = cvData.languages ?? [];

		const parsedData: Omit<ParsedCVData, "_id"> = {
			personal: {
				fullName: personal.fullName ?? null,
				firstName: personal.firstName ?? null,
				lastName: personal.lastName ?? null,
				email: personal.email ?? null,
				phone: personal.phone ?? null,
				location: personal.location ?? null,
				nationality: personal.nationality ?? null,
				rightToWork: personal.rightToWork ?? null,
			},
			links: links
				.filter((l) => l.url) // Filter out links with null URLs
				.map((l) => ({
					type: l.type,
					url: l.url ?? "",
				})),
			headline: cvData.headline ?? null,
			summary: cvData.summary ?? null,
			summaryFacts: cvData.summaryFacts ?? [],
			profileSignals: cvData.profileSignals ?? {},
			experience: experience.map((exp) => ({
				role: exp.role ?? null,
				company: exp.company ?? null,
				startDate: exp.startDate ?? null,
				endDate: exp.endDate ?? null,
				description: exp.description ?? null,
				experienceFacts: exp.experienceFacts ?? [],
			})),
			education: education.map((edu) => ({
				degree: edu.degree ?? null,
				field: edu.field ?? null,
				institution: edu.institution ?? null,
				startDate: edu.startDate ?? null,
				endDate: edu.endDate ?? null,
			})),
			certifications: certifications.map((cert) => ({
				name: cert.name,
				issuer: cert.issuer ?? null,
				date: cert.date ?? null,
			})),
			languages: languages.map((lang) => ({
				language: lang.language,
				level: lang.level ?? null,
			})),
			extras: {
				drivingLicense: cvData.extras?.drivingLicense ?? null,
				workPermit: cvData.extras?.workPermit ?? null,
				willingToRelocate: cvData.extras?.willingToRelocate ?? null,
				remotePreference: cvData.extras?.remotePreference ?? null,
				noticePeriod: cvData.extras?.noticePeriod ?? null,
				availability: cvData.extras?.availability ?? null,
				salaryExpectation: cvData.extras?.salaryExpectation ?? null,
			},
			rawText: cvData.rawText,
		};

		return {
			parseStatus: "completed",
			parsedData,
			usage,
			finishReason: result.finishReason,
		};
	} catch (error) {
		// Log error details without exposing CV content (PII)
		const errorMessage = error instanceof Error ? error.message : String(error);
		const isSchemaError = errorMessage.includes(
			"response did not match schema",
		);

		// Only log safe metadata, never CV content
		const errorContext = {
			errorName: error instanceof Error ? error.name : "Unknown",
			isSchemaValidationError: isSchemaError,
			cvTextLength: cvText.length,
		};

		// Note: In production, use structured logging instead of console.error
		// This is kept minimal to avoid leaking PII from CV content
		console.error("[extractCVData] Error extracting CV data:", errorContext);

		throw new Error(`Failed to extract CV data: ${errorMessage}`);
	}
}
