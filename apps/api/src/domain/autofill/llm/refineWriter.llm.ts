import type { TokenUsage } from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
import { BaseLlmService } from "./base/baseLlmService.js";
import { GENERAL } from "./rules.js";

const logger = createLogger("refine.writer");

const REFINE_WRITER_PROMPT = `
You are a job applicant refining your OWN previous answer
to a job application field.

You are NOT writing a new answer.
You are adjusting an existing one using ONLY the provided context.

INPUT:
- Field label
- Field description
- Existing answer
- Optional user instruction
- Context (a selected subset of:
  profileSignals, summaryFacts, experienceFacts, jdFacts)

TASK:
- Refine the existing answer to better match the field intent
  and the user instruction.
- Use ONLY information present in the provided context
  or already present in the existing answer.
- Apply the user instruction ONLY if it is supported by the provided context.
- Do NOT invent or add new facts, skills, tools, responsibilities, or claims.
- Do NOT expand scope beyond what the field asks.
- If no safe refinement is possible, return the original answer unchanged.

IMPORTANT CONSTRAINTS:
- Do NOT decide what data is relevant.
- Do NOT assume missing information.
- profileSignals are high-level metadata only:
  do NOT use them to invent concrete examples.
- If a claim is not directly supported by the context, omit it.

STYLE:
- Natural, human phrasing
- No résumé tone
- No promotional or sales language
- No meta commentary

RETURN JSON ONLY:
{
  "refinedAnswer": "..."
}

GENERAL RULES:
${GENERAL}
`;

export interface RefineWriterInput {
	fieldLabel: string;
	fieldDescription: string;
	existingAnswer: string;
	userInstructions: string;
	context: RefineContext;
}

export interface RefineContext {
	profileSignals?: Record<string, string>;
	summaryFacts?: string[];
	experienceFacts?: Array<{
		role: string | null;
		company: string | null;
		facts: string[];
	}>;
	jdFacts?: Array<{ key: string; value: string; source: string }>;
}

interface RefineWriterResponse {
	refinedAnswer: string;
}

class RefineWriterService extends BaseLlmService<RefineWriterInput, string> {
	protected get temperature(): number {
		return 0.3;
	}

	protected buildPrompt(input: RefineWriterInput): string {
		return `${REFINE_WRITER_PROMPT}

Field Label:
${input.fieldLabel}

Field Description:
${input.fieldDescription || "(none)"}

Existing Answer:
${input.existingAnswer}

User Instruction:
${input.userInstructions || "(none)"}

Context:
${JSON.stringify(input.context, null, 2)}`;
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

		const response = parsed as RefineWriterResponse;

		if (typeof response.refinedAnswer !== "string") {
			throw new Error("LLM response refinedAnswer is not a string");
		}

		return response.refinedAnswer;
	}
}

const refineWriterService = new RefineWriterService();

export async function writeRefinedAnswer(
	input: RefineWriterInput,
): Promise<{ refinedAnswer: string; usage: TokenUsage }> {
	logger.info({ fieldLabel: input.fieldLabel }, "Writing refined answer");

	const { result: refinedAnswer, usage } =
		await refineWriterService.execute(input);

	logger.info({ usage }, "Refine writer token usage");

	return { refinedAnswer, usage };
}
