import type { TokenUsage } from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
import { BaseLlmService } from "./base/baseLlmService.js";
import { GENERAL } from "./rules.js";

const logger = createLogger("refine.llm");

const REFINE_INFERENCE_PROMPT = `
You are a job applicant refining your own previous answer to a job application field.

You are NOT writing a new answer.
You are adjusting an existing one using the provided CV context.

INPUT:
- Field label
- Existing answer
- CV context (may be partial or complete)
- Optional user instruction

TASK:
- Refine the existing answer to better match the field intent and user instruction
- Use ONLY information present in the CV context or the existing answer
- Apply the user instruction only if it is supported by the CV context
- Do not add new facts, skills, tools, responsibilities, or claims
- Do not expand scope beyond what the field asks
- If no safe refinement is possible, return the original answer unchanged

STYLE:
- Natural, human phrasing
- No résumé tone, no promotional language
- No meta commentary

RETURN JSON ONLY:
{
  "refinedAnswer": "..."
}

GENERAL RULES:
${GENERAL}
`;

export interface RefineInput {
	cvRawText: string;
	fieldLabel: string;
	fieldDescription: string;
	existingAnswer: string;
	userInstructions: string;
}

export interface RefineResult {
	refinedAnswer: string;
	usage: TokenUsage;
}

interface RefineResponse {
	refinedAnswer: string;
}

/**
 * LLM service for refining field values with user instructions.
 * Extends BaseLlmService to leverage shared model invocation and usage calculation.
 */
class RefineService extends BaseLlmService<RefineInput, string> {
	protected get temperature(): number {
		return 0.3;
	}

	protected buildPrompt(input: RefineInput): string {
		return `${REFINE_INFERENCE_PROMPT}

Field Label:
${input.fieldLabel}

Field Description:
${input.fieldDescription || "(none)"}

Existing Answer:
${input.existingAnswer}

CV Context:
${input.cvRawText}

User Instruction:
${input.userInstructions}`;
	}

	protected parseResponse(text: string): string {
		const parsed = this.parseJsonFromMarkdown(text);

		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!("refinedAnswer" in parsed)
		) {
			throw new Error("LLM response does not contain refinedAnswer field");
		}

		const response = parsed as RefineResponse;

		if (typeof response.refinedAnswer !== "string") {
			throw new Error("LLM response refinedAnswer is not a string");
		}

		return response.refinedAnswer;
	}
}

const refineService = new RefineService();

export async function refineFieldValue(
	input: RefineInput,
): Promise<RefineResult> {
	logger.info(
		{ fieldLabel: input.fieldLabel },
		"Refining field value with user instructions",
	);

	const { result: refinedAnswer, usage } = await refineService.execute(input);

	logger.info({ usage }, "Refine token usage");

	return { refinedAnswer, usage };
}
