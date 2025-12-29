import type { Field, TokenUsage } from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
import { createEmptyUsage } from "@/domain/usage/index.js";
import { BaseLlmService } from "./base/baseLlmService.js";

const logger = createLogger("jdMatcher.llm");

/**
 * Input for JD-to-form matching
 */
export interface JdMatchInput {
	/** Raw job description text (may be empty) */
	jdText: string;
	/** Extracted form fields metadata */
	formFields: Field[];
	/** URL where the JD was extracted from (may be null) */
	jdUrl: string | null;
	/** URL of the application form */
	formUrl: string;
}

/**
 * Result of JD-to-form matching
 */
export interface JdMatchResult {
	/** Whether the JD matches the form */
	isMatch: boolean;
	/** Token usage from the LLM call */
	usage: TokenUsage;
}

const JD_MATCH_PROMPT = `You verify whether a job description matches a job application form.

INPUT:
- JD: raw job description text (may be empty)
- Form: extracted form field labels, placeholders, and descriptions
- jdURL: URL of the job description page
- formURL: URL of the application form page

TASK:
Determine if the JD and the form refer to the same job.

MATCHING CRITERIA:
- Job title or role consistency
- Company or employer consistency
- Domain or platform consistency
- URL relationship (same domain, known ATS flow, or clear navigation link)
- Form questions align with the responsibilities or role described in the JD

RULES:
- URL match alone is NOT sufficient
- Content similarity alone is NOT sufficient
- Use both content and URL signals together
- Be strict: if unsure, return false

RETURN JSON ONLY.

OUTPUT FORMAT:
{
  "isMatch": true | false
}
`;

/**
 * LLM service for validating JD-to-form matching.
 * Extends BaseLlmService to leverage shared model invocation and usage calculation.
 */
class JdMatcherService extends BaseLlmService<JdMatchInput, boolean> {
	protected get temperature(): number {
		return 0;
	}

	protected buildPrompt(input: JdMatchInput): string {
		const formFieldsData = input.formFields.map(({ field }) => ({
			label: field.label,
			placeholder: field.placeholder,
			description: field.description,
			name: field.name,
			type: field.type,
		}));

		const inputData = {
			jd: input.jdText || "(empty)",
			formFields: formFieldsData,
			jdURL: input.jdUrl,
			formURL: input.formUrl,
		};

		return `${JD_MATCH_PROMPT}\n\nINPUT DATA:\n${JSON.stringify(inputData, null, 2)}`;
	}

	protected parseResponse(text: string): boolean {
		const parsed = this.parseJsonFromMarkdown(text);

		if (
			typeof parsed !== "object" ||
			parsed === null ||
			typeof (parsed as { isMatch?: unknown }).isMatch !== "boolean"
		) {
			logger.warn(
				{ parsed },
				"Invalid JD match response format, defaulting to false",
			);
			return false;
		}

		return (parsed as { isMatch: boolean }).isMatch;
	}
}

const jdMatcherService = new JdMatcherService();

/**
 * Validates whether a job description matches a job application form.
 * This is a stateless LLM query service.
 *
 * @param input - JD and form data for matching
 * @returns Match result with boolean decision and token usage
 */
export async function validateJdFormMatchWithAI(
	input: JdMatchInput,
): Promise<JdMatchResult> {
	if (!input.jdText || input.jdText.trim().length === 0) {
		logger.info("JD text is empty, returning isMatch: false");
		return { isMatch: false, usage: createEmptyUsage() };
	}

	const { result: isMatch, usage } = await jdMatcherService.execute(input);

	logger.info({ usage }, "JD match token usage");

	logger.info(
		{
			isMatch,
			jdUrl: input.jdUrl,
			formUrl: input.formUrl,
			jdTextLength: input.jdText.length,
			formFieldsCount: input.formFields.length,
		},
		"JD-form match result",
	);

	return { isMatch, usage };
}
