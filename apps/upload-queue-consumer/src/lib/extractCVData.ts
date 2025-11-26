import { generateObject, zodSchema } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import * as z from "zod";
import type { ParsedCVData } from "@lazyapply/types";

// Zod schema matching the ExtractedCVData structure
const extractedCVDataSchema = z.object({
	personal: z.object({
		fullName: z.string().nullable(),
		email: z.string().nullable(),
		phone: z.string().nullable(),
		location: z.string().nullable(),
		nationality: z.string().nullable(),
		rightToWork: z.string().nullable(),
	}),
	links: z.array(
		z.object({
			type: z.string(),
			url: z.string(),
		}),
	),
	summary: z.string().nullable(),
	experience: z.array(
		z.object({
			role: z.string().nullable(),
			company: z.string().nullable(),
			startDate: z.string().nullable(),
			endDate: z.string().nullable(),
			description: z.string().nullable(),
		}),
	),
	education: z.array(
		z.object({
			degree: z.string().nullable(),
			field: z.string().nullable(),
			institution: z.string().nullable(),
			startDate: z.string().nullable(),
			endDate: z.string().nullable(),
		}),
	),
	certifications: z.array(
		z.object({
			name: z.string(),
			issuer: z.string().nullable(),
			date: z.string().nullable(),
		}),
	),
	languages: z.array(
		z.object({
			language: z.string(),
			level: z.string().nullable(),
		}),
	),
	extras: z.object({
		drivingLicense: z.string().nullable(),
		workPermit: z.string().nullable(),
		willingToRelocate: z.boolean().nullable(),
		remotePreference: z.string().nullable(),
		noticePeriod: z.string().nullable(),
		availability: z.string().nullable(),
		salaryExpectation: z.string().nullable(),
	}),
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

/**
 * Extract structured CV data from raw text using GPT-4o-mini
 */
export async function extractCVData(
	cvText: string,
	openaiApiKey: string,
): Promise<ParsedCVData> {
	try {
		// Create OpenAI client with API key
		const openai = createOpenAI({
			apiKey: openaiApiKey,
		});

		const result = await generateObject({
			model: openai("gpt-4o-mini"),
			// @ts-expect-error - Zod v4 type compatibility issue with AI SDK's zodSchema helper
			schema: zodSchema(extractedCVDataSchema),
			prompt: `${EXTRACTION_PROMPT}\n\nCV TEXT:\n"""\n${cvText}\n"""`,
		});
		
		// Extract and cast to our inferred type
		const extractedData = result.object as ExtractedCVData;

		// Transform the extracted data to match ParsedCVData format
		const parsedData: ParsedCVData = {
			fileId: "", // Will be set by the caller
			personalInfo: {
				name: extractedData.personal.fullName ?? undefined,
				email: extractedData.personal.email ?? undefined,
				phone: extractedData.personal.phone ?? undefined,
				location: extractedData.personal.location ?? undefined,
				// Extract specific link types
				linkedIn: extractedData.links.find((l) => l.type === "linkedin")?.url,
				github: extractedData.links.find((l) => l.type === "github")?.url,
				website:
					extractedData.links.find(
						(l) => l.type === "website" || l.type === "portfolio",
					)?.url,
			},
			summary: extractedData.summary ?? undefined,
			skills: [], // Skills are not extracted in the new schema
			experience: extractedData.experience.map((exp) => ({
				company: exp.company ?? "",
				position: exp.role ?? "",
				startDate: exp.startDate ?? undefined,
				endDate: exp.endDate ?? undefined,
				description: exp.description ?? undefined,
			})),
			education: extractedData.education.map((edu) => ({
				institution: edu.institution ?? "",
				degree: edu.degree ?? undefined,
				field: edu.field ?? undefined,
				startDate: edu.startDate ?? undefined,
				endDate: edu.endDate ?? undefined,
			})),
			certifications: extractedData.certifications.map((cert) => ({
				name: cert.name,
				issuer: cert.issuer ?? undefined,
				date: cert.date ?? undefined,
			})),
			languages: extractedData.languages.map((lang) => ({
				name: lang.language,
				proficiency: mapLanguageLevel(lang.level),
			})),
			rawText: extractedData.rawText,
		};

		return parsedData;
	} catch (error) {
		console.error("Error extracting CV data:", error);
		throw new Error(
			`Failed to extract CV data: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Map language level to proficiency enum
 */
function mapLanguageLevel(
	level: string | null,
): "native" | "fluent" | "professional" | "intermediate" | "basic" | undefined {
	if (!level) return undefined;

	const normalized = level.toLowerCase();

	if (normalized.includes("native") || normalized.includes("mother tongue"))
		return "native";
	if (normalized.includes("fluent") || normalized.includes("c2"))
		return "fluent";
	if (
		normalized.includes("professional") ||
		normalized.includes("c1") ||
		normalized.includes("advanced")
	)
		return "professional";
	if (
		normalized.includes("intermediate") ||
		normalized.includes("b1") ||
		normalized.includes("b2")
	)
		return "intermediate";
	if (
		normalized.includes("basic") ||
		normalized.includes("a1") ||
		normalized.includes("a2") ||
		normalized.includes("beginner")
	)
		return "basic";

	return undefined;
}
