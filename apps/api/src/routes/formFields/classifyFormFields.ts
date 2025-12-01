import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { Request, Response } from "express";
import { z } from "zod";

import { env } from "@/app/env.js";
import { HttpError } from "@/app/errors.js";
import {
	FORM_FIELD_PATHS,
	type FormFieldClassification,
	type FormFieldPath,
} from "@lazyapply/types";

const formFieldInputSchema = z.object({
	hash: z.string(),
	id: z.string(),
	tag: z.string(),
	type: z.string(),
	name: z.string().nullable(),
	label: z.string().nullable(),
	placeholder: z.string().nullable(),
	description: z.string().nullable(),
	isFileUpload: z.boolean(),
	accept: z.string().nullable(),
});

export const classifyFormFieldsBodySchema = z.object({
	fields: z.array(formFieldInputSchema).min(1).max(100),
});

type ClassifyFormFieldsBody = z.infer<typeof classifyFormFieldsBodySchema>;

const CLASSIFICATION_PROMPT = `You are a strict classifier for job application form fields.

Your goal is to map each HTML form field to a path in our ParsedCVData structure.

RETURN JSON ONLY. NO explanations. If uncertain → return "unknown".

VALID PATHS (use exactly these strings):
- "personal.fullName" - Full name field
- "personal.email" - Email address
- "personal.phone" - Phone number
- "personal.location" - City, address, or location
- "personal.nationality" - Nationality or citizenship
- "personal.rightToWork" - Right to work / visa status
- "links" - Any URL/link field (LinkedIn, GitHub, portfolio, website, etc.)
- "summary" - Professional summary, about me, bio
- "experience" - Work experience, job history, responsibilities
- "education" - Education, degrees, schools
- "certifications" - Certifications, licenses, courses
- "languages" - Language skills
- "extras.drivingLicense" - Driving license
- "extras.workPermit" - Work permit
- "extras.willingToRelocate" - Relocation willingness
- "extras.remotePreference" - Remote work preference
- "extras.noticePeriod" - Notice period
- "extras.availability" - Start date, availability
- "extras.salaryExpectation" - Salary expectation
- "resume_upload" - CV/Resume file upload
- "cover_letter" - Cover letter text or upload
- "motivation_text" - Why us / Why you / Motivation letter
- "unknown" - Cannot determine

INPUT FORMAT:
[
  {
    "hash": string,
    "tag": string,
    "type": string,
    "name": string | null,
    "label": string | null,
    "placeholder": string | null,
    "description": string | null,
    "isFileUpload": boolean,
    "accept": string | null
  }
]

INSTRUCTIONS:
- Use name, label, placeholder, description, input type, accept, and tag to classify.
- If the field uploads a CV/resume → "resume_upload". If it accepts multiple document types, return multiple objects with the same hash.
- For URL fields: return "links" and include "linkType". If field asks for multiple links, return multiple objects with the same hash and different linkType.
- Motivation / Why us / Why you → "motivation_text".
- Summary / about me → "summary".
- If unclear → "unknown".

OUTPUT FORMAT:
[
  {
    "hash": string,
    "path": string,
    "linkType": string | undefined  // Only for "links" path
  }
]

If a field accepts multiple types, return MULTIPLE objects with the SAME hash:
[
  { "hash": "abc", "path": "resume_upload" },
  { "hash": "abc", "path": "cover_letter" },
  { "hash": "abc", "path": "certifications" }
]

CLASSIFY THE FOLLOWING FIELDS:`;

const VALID_PATHS = new Set<string>(FORM_FIELD_PATHS);

function parseClassificationResponse(
	text: string,
	inputHashes: Set<string>,
): FormFieldClassification[] {
	let jsonText = text.trim();
	if (jsonText.startsWith("```")) {
		const lines = jsonText.split("\n");
		lines.shift();
		while (lines.length > 0 && lines[lines.length - 1].startsWith("```")) {
			lines.pop();
		}
		jsonText = lines.join("\n");
	}

	const parsed: unknown = JSON.parse(jsonText);

	if (!Array.isArray(parsed)) {
		throw new Error("LLM response is not an array");
	}

	const results: FormFieldClassification[] = [];

	for (const item of parsed) {
		if (
			typeof item !== "object" ||
			item === null ||
			typeof item.hash !== "string" ||
			typeof item.path !== "string"
		) {
			continue;
		}

		if (!inputHashes.has(item.hash)) {
			continue;
		}

		const path: FormFieldPath = VALID_PATHS.has(item.path)
			? (item.path as FormFieldPath)
			: "unknown";

		const result: FormFieldClassification = { hash: item.hash, path };

		if (path === "links" && typeof item.linkType === "string") {
			result.linkType = item.linkType;
		}

		results.push(result);
	}

	return results;
}

export async function classifyFormFields(
	req: Request<unknown, FormFieldClassification[], ClassifyFormFieldsBody>,
	res: Response<FormFieldClassification[]>,
): Promise<void> {
	const { fields } = req.body;

	if (!env.OPENAI_API_KEY) {
		throw new HttpError(
			"OpenAI API key not configured",
			new Error("OPENAI_API_KEY is required"),
		);
	}

	const fieldsForPrompt = fields.map(
		({
			hash,
			tag,
			type,
			name,
			label,
			placeholder,
			description,
			isFileUpload,
			accept,
		}) => ({
			hash,
			tag,
			type,
			name,
			label,
			placeholder,
			description,
			isFileUpload,
			accept,
		}),
	);

	const prompt = `${CLASSIFICATION_PROMPT}\n${JSON.stringify(fieldsForPrompt, null, 2)}`;

	const result = await generateText({
		model: openai("gpt-4o-mini"),
		prompt,
	});

	const inputHashes = new Set(fields.map((f) => f.hash));
	const classifications = parseClassificationResponse(result.text, inputHashes);

	res.json(classifications);
}
