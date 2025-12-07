import { openai } from "@ai-sdk/openai";
import {
	type ClassifiedField,
	type Field,
	FORM_FIELD_PATH_MAP,
	type FormFieldPath,
	type TokenUsage,
} from "@lazyapply/types";
import { generateText } from "ai";
import { env } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";

/**
 * Generates the valid paths section of the prompt from FORM_FIELD_PATH_MAP
 */
function generateValidPathsSection(): string {
	return Object.entries(FORM_FIELD_PATH_MAP)
		.map(([path, description]) => `- "${path}" - ${description}`)
		.join("\n");
}

const CLASSIFICATION_PROMPT_HEADER = `You are a strict classifier for job application form fields.

Your goal is to map each HTML form field to a path in our ParsedCVData structure.

RETURN JSON ONLY. NO explanations. If uncertain → return "unknown".

VALID PATHS (use exactly these strings):
${generateValidPathsSection()}

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
]

`;

const CLASSIFICATION_PROMPT = `${CLASSIFICATION_PROMPT_HEADER}CLASSIFY THE FOLLOWING FIELDS:`;

const VALID_PATHS = new Set<string>(Object.keys(FORM_FIELD_PATH_MAP));

const logger = createLogger("classifier.service");

interface RawClassificationItem {
	hash: string;
	path: string;
	linkType?: string;
}

export type EnrichedClassifiedField = ClassifiedField & Field;

export interface ClassificationResult {
	classifiedFields: EnrichedClassifiedField[];
	usage: TokenUsage;
}

/**
 * Builds the prompt for field classification
 */
function buildClassificationPrompt(fields: Field[]): string {
	const fieldsForPrompt = fields.map(({ hash, field }) => ({
		hash: hash,
		tag: field.tag,
		type: field.type,
		name: field.name,
		label: field.label,
		placeholder: field.placeholder,
		description: field.description,
		isFileUpload: field.isFileUpload,
		accept: field.accept,
	}));

	return `${CLASSIFICATION_PROMPT}\n${JSON.stringify(fieldsForPrompt, null, 2)}`;
}

/**
 * Calls the AI model to classify form fields
 */
async function callClassificationModel(
	prompt: string,
): Promise<{ text: string; usage: TokenUsage }> {
	const result = await generateText({
		model: openai(env.OPENAI_MODEL),
		prompt,
	});

	const promptTokens = result.usage.inputTokens ?? 0;
	const completionTokens = result.usage.outputTokens ?? 0;
	const totalTokens = result.usage.totalTokens ?? 0;
	const inputCost =
		(promptTokens / 1_000_000) * env.OPENAI_MODEL_INPUT_PRICE_PER_1M;
	const outputCost =
		(completionTokens / 1_000_000) * env.OPENAI_MODEL_OUTPUT_PRICE_PER_1M;
	const totalCost = inputCost + outputCost;

	return {
		text: result.text,
		usage: {
			promptTokens,
			completionTokens,
			totalTokens,
			inputCost,
			outputCost,
			totalCost,
		},
	};
}

/**
 * Parses the LLM response into structured classifications enriched with field data
 */
function parseClassificationResponse(
	text: string,
	fields: Field[],
): EnrichedClassifiedField[] {
	const fieldsByHash = new Map(fields.map((f) => [f.hash, f]));
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

	const results: EnrichedClassifiedField[] = [];

	for (const item of parsed as RawClassificationItem[]) {
		if (
			typeof item !== "object" ||
			item === null ||
			typeof item.hash !== "string" ||
			typeof item.path !== "string"
		) {
			continue;
		}

		const originalField = fieldsByHash.get(item.hash);
		if (!originalField) {
			continue;
		}

		const classification: FormFieldPath = VALID_PATHS.has(item.path)
			? (item.path as FormFieldPath)
			: "unknown";

		const result: EnrichedClassifiedField = {
			...originalField,
			classification,
		};

		if (classification === "links" && typeof item.linkType === "string") {
			result.linkType = item.linkType;
		}

		results.push(result);
	}

	return results;
}

/**
 * Classifies form fields using AI
 */
export async function classifyFieldsWithAI(
	fields: Field[],
): Promise<ClassificationResult> {
	const prompt = buildClassificationPrompt(fields);
	const { text, usage } = await callClassificationModel(prompt);

	logger.info({ usage }, "Token usage");

	const classifiedFields = parseClassificationResponse(text, fields);

	return { classifiedFields, usage };
}
