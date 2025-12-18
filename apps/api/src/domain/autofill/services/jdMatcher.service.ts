import { openai } from "@ai-sdk/openai";
import type { Field, TokenUsage } from "@lazyapply/types";
import { generateText } from "ai";
import { env } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";

const logger = createLogger("jdMatcher.service");

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
 * Builds the prompt for JD-to-form matching
 */
function buildJdMatchPrompt(input: JdMatchInput): string {
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

/**
 * Calls the AI model to determine JD-form match
 */
async function callJdMatchModel(
	prompt: string,
): Promise<{ text: string; usage: TokenUsage }> {
	const result = await generateText({
		model: openai(env.OPENAI_MODEL),
		prompt,
		temperature: 0,
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
 * Parses the LLM response into a boolean match result
 */
function parseJdMatchResponse(text: string): boolean {
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

/**
 * Validates whether a job description matches a job application form.
 * This is a stateless LLM query service.
 *
 * @param input - JD and form data for matching
 * @returns Match result with boolean decision and token usage
 */
export async function validateJdFormMatch(
	input: JdMatchInput,
): Promise<JdMatchResult> {
	// Early return if JD is empty
	if (!input.jdText || input.jdText.trim().length === 0) {
		logger.info("JD text is empty, returning isMatch: false");
		return {
			isMatch: false,
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

	const prompt = buildJdMatchPrompt(input);
	const { text, usage } = await callJdMatchModel(prompt);

	logger.info({ usage }, "JD match token usage");

	const isMatch = parseJdMatchResponse(text);

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
