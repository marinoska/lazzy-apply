import type { Field, TokenUsage } from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
import { createEmptyUsage } from "@/domain/usage/index.js";
import { BaseLlmService } from "./base/baseLlmService.js";

const logger = createLogger("jdMatcher.llm");

/**
 * Input for JD-to-form matching
 */
export interface JdFormFactsInput {
	/** Raw job description text (may be empty) */
	jdRawText: string;
	/** Contextual text extracted from the form page */
	formContext: string;
	/** Extracted form fields metadata */
	formFields: Field[];
	/** URL where the JD was extracted from (may be null) */
	jdUrl: string | null;
	/** URL of the application form */
	formUrl: string;
}

/**
 * A single fact extracted from JD or form
 */
export interface JdFormFact {
	/** Short key identifying the fact type (e.g., "role", "location", "salary") */
	key: string;
	/** The actual fact value */
	value: string;
	/** Source of the fact: "jd" or "form" */
	source: "jd" | "form";
}

/**
 * Result of JD-to-form matching
 */
export interface JdFactsResult {
	/** Whether the JD matches the form */
	isMatch: boolean;
	/** Extracted facts from JD and/or form */
	jdFacts: JdFormFact[];
	/** Token usage from the LLM call */
	usage: TokenUsage;
}

const JD_FACTS_PROMPT = `
You verify whether a job description matches a job application form AND extract grounded job facts.

INPUT:
- jd: raw job description text (may be empty)
- formContext: surrounding text near the application form (page content, headers, sections)
- formFields: extracted form field labels, placeholders, and descriptions
- jdURL: URL of the job description page
- formURL: URL of the application form page

TASK PART 1: MATCHING

Determine whether the JD and the form refer to the same job.

MATCHING RULES:
- If jdURL is exactly equal to formURL, the match is TRUE with full certainty.
- Otherwise, determine the match using the criteria below.

MATCHING CRITERIA (when URLs differ):
- Job role or title consistency across jd, formContext, and formFields
- Company or employer consistency
- Domain, product, or platform consistency
- URL relationship (same domain, known ATS flow, or clear navigation path)
- Form questions align with responsibilities, seniority, or expectations implied by the JD

STRICTNESS RULES:
- URL similarity alone is NOT sufficient (unless URLs are exactly equal)
- Content similarity alone is NOT sufficient
- Use formContext as a strong supporting signal
- If unsure, treat as NOT a match

TASK PART 2: FACT EXTRACTION

If isMatch = true:
- Extract job-related facts using jd, formContext, and formFields
- Prefer JD for role definition and responsibilities
- Use formContext and formFields to confirm expectations and constraints

If isMatch = false OR jd is empty:
- Extract job-related facts using ONLY formContext and formFields
- Do NOT use JD content in this case

FACT EXTRACTION RULES:
- Extract ONLY facts explicitly stated in the allowed inputs
- Each fact must be atomic (one fact per entry)
- Do NOT infer or guess missing information
- Do NOT normalize or group facts beyond assigning a short key
- Use short, lowercase keys (e.g. "role", "location", "salary", "responsibility", "skill", "contract_type", "work_mode")
- Repeat keys if multiple facts exist
- Include the source of each fact: "jd", "form", or "formContext"
- Omit vague, implied, or speculative information

RETURN JSON ONLY.

OUTPUT FORMAT:
{
  "isMatch": true | false,
  "jdFacts": {
    "facts": [
      {
        "key": string,
        "value": string,
        "source": "jd" | "form" | "formContext"
      }
    ]
  }
}
`;

/**
 * Response format from the LLM
 */
interface JdFactsLlmResponse {
	isMatch: boolean;
	jdFacts: {
		facts: JdFormFact[];
	};
}

/**
 * LLM service for validating JD-to-form matching.
 * Extends BaseLlmService to leverage shared model invocation and usage calculation.
 */
class JdFactsExtractor extends BaseLlmService<
	JdFormFactsInput,
	JdFactsLlmResponse
> {
	protected get temperature(): number {
		return 0;
	}

	protected buildPrompt(input: JdFormFactsInput): string {
		const formFieldsData = input.formFields.map(({ field }) => ({
			label: field.label,
			placeholder: field.placeholder,
			description: field.description,
			name: field.name,
			type: field.type,
		}));

		const inputData = {
			jd: input.jdRawText || "(empty)",
			formContext: input.formContext,
			formFields: formFieldsData,
			jdURL: input.jdUrl,
			formURL: input.formUrl,
		};

		return `${JD_FACTS_PROMPT}\n\nINPUT DATA:\n${JSON.stringify(inputData, null, 2)}`;
	}

	protected parseResponse(text: string): JdFactsLlmResponse {
		const parsed = this.parseJsonFromMarkdown(text);

		if (
			typeof parsed !== "object" ||
			parsed === null ||
			typeof (parsed as { isMatch?: unknown }).isMatch !== "boolean" ||
			typeof (parsed as { jdFacts?: unknown }).jdFacts !== "object" ||
			(parsed as { jdFacts?: { facts?: unknown } }).jdFacts?.facts ===
				undefined ||
			!Array.isArray((parsed as { jdFacts: { facts: unknown } }).jdFacts.facts)
		) {
			logger.warn(
				{ parsed },
				"Invalid JD match response format, defaulting to false with empty facts",
			);
			return { isMatch: false, jdFacts: { facts: [] } };
		}

		return parsed as JdFactsLlmResponse;
	}
}

const jdFactsExtractService = new JdFactsExtractor();

/**
 * Validates whether a job description matches a job application form
 * and extracts structured facts from combined JD and application form.
 * This is a stateless LLM query service.
 *
 * @param input - JD and form data for matching and fact extraction
 * @returns Match result with boolean decision, extracted facts, and token usage
 */
export async function extractJdFormFactsWithAI(
	input: JdFormFactsInput,
): Promise<JdFactsResult> {
	if (!input.jdRawText || input.jdRawText.trim().length === 0) {
		logger.info("JD text is empty, returning isMatch: false");
		return { isMatch: false, jdFacts: [], usage: createEmptyUsage() };
	}

	const { result, usage } = await jdFactsExtractService.execute(input);
	const { isMatch, jdFacts } = result;

	logger.info({ usage }, "JD match token usage");

	logger.info(
		{
			isMatch,
			jdUrl: input.jdUrl,
			formUrl: input.formUrl,
			jdRawTextLength: input.jdRawText.length,
			formFieldsCount: input.formFields.length,
		},
		"JD-form match result",
	);

	return { isMatch, jdFacts: jdFacts.facts, usage };
}
