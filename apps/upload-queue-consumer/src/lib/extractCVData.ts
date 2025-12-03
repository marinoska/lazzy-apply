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

// Zod schema matching the ExtractedCVData structure
// Using .optional() for fields that might not be present in AI response
const extractedCVDataSchema = z.object({
	personal: z
		.object({
			fullName: z.string().nullable().optional(),
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
	experience: z
		.array(
			z.object({
				role: z.string().nullable().optional(),
				company: z.string().nullable().optional(),
				startDate: z.string().nullable().optional(),
				endDate: z.string().nullable().optional(),
				description: z.string().nullable().optional(),
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

// Infer the TypeScript type from the schema
type ExtractedCVData = z.infer<typeof extractedCVDataSchema>;

// Type helper to avoid deep instantiation issues
type SchemaType = typeof extractedCVDataSchema;

const EXTRACTION_PROMPT = `You are an information extraction engine. 
Your task is to extract structured data from a CV exactly following the JSON schema below.

IMPORTANT RULES:
- Do NOT hallucinate.
- Only extract information that is explicitly present in the CV.
- If any field is missing or unclear → return null for that field.
- Dates may remain in their original format.
- The "links" list must classify each link using best-fit category ("linkedin", "portfolio", "github", "behance", "dribbble", "twitter", "website", "other").
- "experience.description" must contain the full text of that job's responsibilities/achievements.
- Never invent degrees, skills, certifications, or experience.
- Return VALID JSON ONLY. No explanations. No comments. No markdown.

OUTPUT SCHEMA:

{
  "personal": {
    "fullName": string | null,
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

  "experience": [
    {
      "role": string | null,
      "company": string | null,
      "startDate": string | null,
      "endDate": string | null,
      "description": string | null
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

export type ExtractCVDataResult = {
	parsedData: ParsedCVData;
	usage: TokenUsage;
	finishReason:
		| "stop"
		| "length"
		| "content-filter"
		| "tool-calls"
		| "error"
		| "other"
		| "unknown";
};

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
		});

		// Extract and cast to our inferred type
		const extractedData = result.object as ExtractedCVData;

		// Transform the extracted data to match ParsedCVData format
		const personal = extractedData.personal ?? {};
		const links = extractedData.links ?? [];
		const experience = extractedData.experience ?? [];
		const education = extractedData.education ?? [];
		const certifications = extractedData.certifications ?? [];
		const languages = extractedData.languages ?? [];

		const parsedData: ParsedCVData = {
			personal: {
				fullName: personal.fullName ?? null,
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
					url: l.url!,
				})),
			headline: extractedData.headline ?? null,
			summary: extractedData.summary ?? null,
			experience: experience.map((exp) => ({
				role: exp.role ?? null,
				company: exp.company ?? null,
				startDate: exp.startDate ?? null,
				endDate: exp.endDate ?? null,
				description: exp.description ?? null,
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
				drivingLicense: extractedData.extras?.drivingLicense ?? null,
				workPermit: extractedData.extras?.workPermit ?? null,
				willingToRelocate: extractedData.extras?.willingToRelocate ?? null,
				remotePreference: extractedData.extras?.remotePreference ?? null,
				noticePeriod: extractedData.extras?.noticePeriod ?? null,
				availability: extractedData.extras?.availability ?? null,
				salaryExpectation: extractedData.extras?.salaryExpectation ?? null,
			},
			rawText: extractedData.rawText,
		};

		const promptTokens = result.usage.inputTokens ?? 0;
		const completionTokens = result.usage.outputTokens ?? 0;
		const totalTokens = result.usage.totalTokens ?? 0;

		// Calculate cost breakdown using pricing from environment
		const inputCost = (promptTokens / 1_000_000) * inputPricePer1M;
		const outputCost = (completionTokens / 1_000_000) * outputPricePer1M;
		const totalCost = inputCost + outputCost;

		return {
			parsedData,
			usage: {
				promptTokens,
				completionTokens,
				totalTokens,
				inputCost,
				outputCost,
				totalCost,
			},
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
