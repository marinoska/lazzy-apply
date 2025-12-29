import {
	type ClassifiedField,
	type Field,
	FORM_FIELD_PATH_MAP,
	type FormFieldPath,
	INFERENCE_HINTS,
	type InferenceHint,
	type TokenUsage,
} from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
import { createEmptyUsage } from "@/domain/usage/index.js";
import { BaseLlmService } from "./base/baseLlmService.js";

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
- If the field is for cover letter (text or file upload) → "cover_letter". Look for name/label containing "cover_letter", "cover letter", "coverletter".
- For URL fields: return "links" and include "linkType". If field asks for multiple links, return multiple objects with the same hash and different linkType.
- Motivation / Why us / Why you → "motivation_text".
- Summary / about me → "summary".
- If unclear → "unknown".

INFERENCE HINT RULES:
For open-ended text fields that do NOT map to any existing path but CAN be answered using Job Description + CV data:
- Set path to "unknown"
- Set inferenceHint to "text_from_jd_cv"

Examples of fields requiring inferenceHint:
- "Why do you want this role?"
- "Why are you a good fit?"
- "Describe relevant experience"
- "Motivation"
- "Additional information"

Do NOT set inferenceHint for:
- Fields that map to existing paths
- Consent/checkbox fields
- Unclear or irrelevant fields
- Fields that cannot be inferred from JD + CV

OUTPUT FORMAT:
[
  {
    "hash": string,
    "path": string,
    "linkType": string | undefined,  // Only for "links" path
    "inferenceHint": "text_from_jd_cv" | undefined  // Only when path is "unknown" and field is answerable via JD + CV
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

const logger = createLogger("classifier.llm");

interface RawClassificationItem {
	hash: string;
	path: string;
	linkType?: string;
	inferenceHint?: string;
}

const VALID_INFERENCE_HINTS = new Set<string>(INFERENCE_HINTS);

export type EnrichedClassifiedField = ClassifiedField & Field;

export interface ClassificationResult {
	classifiedFields: EnrichedClassifiedField[];
	usage: TokenUsage;
}

/**
 * LLM service for classifying form fields into CV data paths.
 * Extends BaseLlmService to leverage shared model invocation and usage calculation.
 */
class FieldClassifierService extends BaseLlmService<
	Field[],
	EnrichedClassifiedField[]
> {
	protected get temperature(): number {
		return 0;
	}

	protected buildPrompt(fields: Field[]): string {
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

	protected parseResponse(
		text: string,
		fields: Field[],
	): EnrichedClassifiedField[] {
		const fieldsByHash = new Map(fields.map((f) => [f.hash, f]));
		const classifiedHashes = new Set<string>();

		const parsed = this.parseJsonFromMarkdown(text);

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

			classifiedHashes.add(item.hash);

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

			if (
				classification === "unknown" &&
				typeof item.inferenceHint === "string" &&
				VALID_INFERENCE_HINTS.has(item.inferenceHint)
			) {
				result.inferenceHint = item.inferenceHint as InferenceHint;
			}

			results.push(result);
		}

		for (const field of fields) {
			if (!classifiedHashes.has(field.hash)) {
				logger.warn(
					{ hash: field.hash, name: field.field.name },
					"LLM did not classify field, defaulting to unknown",
				);
				results.push({
					...field,
					classification: "unknown",
				});
			}
		}

		return results;
	}
}

const fieldClassifier = new FieldClassifierService();

/**
 * Classifies form fields using AI
 */
export async function classifyFieldsWithAI(
	fields: Field[],
): Promise<ClassificationResult> {
	if (fields.length === 0) {
		return { classifiedFields: [], usage: createEmptyUsage() };
	}

	const { result: classifiedFields, usage } =
		await fieldClassifier.execute(fields);

	logger.info({ usage }, "Token usage");

	return { classifiedFields, usage };
}
