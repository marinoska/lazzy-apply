import { openai } from "@ai-sdk/openai";
import type { TokenUsage } from "@lazyapply/types";
import { generateText } from "ai";
import { env } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
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

function buildRefinePrompt(input: RefineInput): string {
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

function parseRefineResponse(text: string): string {
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

export async function refineFieldValue(
	input: RefineInput,
): Promise<RefineResult> {
	const prompt = buildRefinePrompt(input);

	logger.info(
		{ fieldLabel: input.fieldLabel },
		"Refining field value with user instructions",
	);

	const result = await generateText({
		model: openai(env.OPENAI_MODEL),
		prompt,
		temperature: 0.3,
	});

	const promptTokens = result.usage.inputTokens ?? 0;
	const completionTokens = result.usage.outputTokens ?? 0;
	const totalTokens = result.usage.totalTokens ?? 0;
	const inputCost =
		(promptTokens / 1_000_000) * env.OPENAI_MODEL_INPUT_PRICE_PER_1M;
	const outputCost =
		(completionTokens / 1_000_000) * env.OPENAI_MODEL_OUTPUT_PRICE_PER_1M;
	const totalCost = inputCost + outputCost;

	const usage: TokenUsage = {
		promptTokens,
		completionTokens,
		totalTokens,
		inputCost,
		outputCost,
		totalCost,
	};

	logger.info({ usage }, "Refine token usage");

	const refinedAnswer = parseRefineResponse(result.text);

	return { refinedAnswer, usage };
}
