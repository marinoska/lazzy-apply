import type { Field, TokenUsage } from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
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

const FACT_EXTRACTION_RULES = `FACT EXTRACTION RULES:
- Extract ONLY facts explicitly stated in the allowed inputs
- Each fact must be atomic (one fact per entry)
- Do NOT infer or guess missing information
- Do NOT normalize or group facts beyond assigning a short key
- Use short, lowercase keys (e.g. "role", "location", "salary", "responsibility", "skill", "contract_type", "work_mode")
- Repeat keys if multiple facts exist
- Omit vague, implied, or speculative information`;

const JD_FACTS_MATCHING_PROMPT = `
You verify whether a job description matches a job application form AND extract grounded job facts.

INPUT:
- jd: raw job description text (may be empty)
- formContext: surrounding text near the application form (page content, headers, sections)
- jdURL: URL of the job description page
- formURL: URL of the application form page

TASK PART 1: MATCHING

Determine whether the JD and the form refer to the same job.

MATCHING CRITERIA:
- Job role or title consistency across jd and formContext
- Company or employer consistency
- Domain, product, or platform consistency
- URL relationship (same domain, known ATS flow, or clear navigation path)
- Form content aligns with responsibilities, seniority, or expectations implied by the JD

STRICTNESS RULES:
- URL similarity alone is NOT sufficient
- Content similarity alone is NOT sufficient
- Use formContext as a strong supporting signal
- If unsure, treat as NOT a match

TASK PART 2: FACT EXTRACTION

If isMatch = true:
- Extract job-related facts using jd and formContext
- Prefer JD for role definition and responsibilities
- Use formContext to confirm expectations and constraints

If isMatch = false OR jd is empty:
- Extract job-related facts using ONLY formContext
- Do NOT use JD content in this case

${FACT_EXTRACTION_RULES}
- Include the source of each fact: "jd", "form", or "formContext"

RETURN JSON ONLY.

OUTPUT FORMAT:
{
  "isMatch": true | false,
  "jdFacts": {
    "facts": [
      {
        "key": string,
        "value": string,
        "source": "jd" | "formContext"
      }
    ]
  }
}
`;

const JD_FACTS_EXTRACTION_ONLY_PROMPT = `
You extract grounded job facts from a job description.

INPUT:
- jd: raw job description text

TASK: FACT EXTRACTION

Extract job-related facts from the job description.

${FACT_EXTRACTION_RULES}
- All facts should have source: "jd"

RETURN JSON ONLY.

OUTPUT FORMAT:
{
  "jdFacts": {
    "facts": [
      {
        "key": string,
        "value": string,
        "source": "jd"
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
		const urlsMatch = input.jdUrl === input.formUrl;

		if (urlsMatch) {
			const jdText = input.jdRawText?.trim() || input.formContext || "(empty)";
			const inputData = {
				jd: jdText,
			};
			return `${JD_FACTS_EXTRACTION_ONLY_PROMPT}\n\nINPUT DATA:\n${JSON.stringify(inputData, null, 2)}`;
		}

		const inputData = {
			jd: input.jdRawText || "(empty)",
			formContext: input.formContext,
			jdURL: input.jdUrl,
			formURL: input.formUrl,
		};

		return `${JD_FACTS_MATCHING_PROMPT}\n\nINPUT DATA:\n${JSON.stringify(inputData, null, 2)}`;
	}

	protected parseResponse(text: string): JdFactsLlmResponse {
		const parsed = this.parseJsonFromMarkdown(text);

		if (
			typeof parsed !== "object" ||
			parsed === null ||
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

		const isMatch =
			typeof (parsed as { isMatch?: unknown }).isMatch === "boolean"
				? (parsed as { isMatch: boolean }).isMatch
				: true;

		return {
			isMatch,
			jdFacts: (parsed as { jdFacts: { facts: JdFormFact[] } }).jdFacts,
		};
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
	const urlsMatch = input.jdUrl === input.formUrl;
	const hasJdText = input.jdRawText && input.jdRawText.trim() !== "";
	const hasFormContext = input.formContext && input.formContext.trim() !== "";

	if (!hasJdText && !(urlsMatch && hasFormContext)) {
		logger.info(
			"JD text is empty and no formContext fallback available, skipping LLM call",
		);
		return {
			isMatch: false,
			jdFacts: [],
			usage: {
				promptTokens: 0,
				completionTokens: 0,
				totalTokens: 0,
				inputCost: 0,
				outputCost: 0,
				totalCost: 0,
			},
		};
	}

	if (urlsMatch) {
		logger.info(
			{ jdUrl: input.jdUrl, formUrl: input.formUrl },
			"URLs match - using extraction-only prompt",
		);
	}

	const { result, usage } = await jdFactsExtractService.execute(input);
	const { isMatch, jdFacts } = result;

	const finalIsMatch = urlsMatch ? true : isMatch;

	logger.info({ usage }, "JD match token usage");

	logger.info(
		{
			isMatch: finalIsMatch,
			jdUrl: input.jdUrl,
			formUrl: input.formUrl,
			jdRawTextLength: input.jdRawText.length,
			formFieldsCount: input.formFields.length,
			urlsMatch,
		},
		"JD-form match result",
	);

	return { isMatch: finalIsMatch, jdFacts: jdFacts.facts, usage };
}
