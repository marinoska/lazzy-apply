import type { TokenUsage } from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
import { routeRefineDataSources } from "./refineRouter.llm.js";
import { type RefineContext, writeRefinedAnswer } from "./refineWriter.llm.js";
import { GENERAL } from "./rules.js";

const logger = createLogger("refine.llm");

/**
 * @deprecated
 * This prompt was used in the monolithic refine service before the router/writer split.
 * Kept for reference. The current implementation uses:
 * - REFINE_ROUTER_PROMPT in refineRouter.llm.ts (decides which data to use)
 * - REFINE_WRITER_PROMPT in refineWriter.llm.ts (performs the actual refinement)
 */
const _REFINE_INFERENCE_PROMPT = `
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
	fieldLabel: string;
	fieldDescription: string;
	existingAnswer: string;
	userInstructions: string;
	profileSignals: Record<string, string>;
	summaryFacts: string[];
	experienceFacts: Array<{
		role: string | null;
		company: string | null;
		facts: string[];
	}>;
	jdFacts: Array<{ key: string; value: string; source: string }>;
}

export interface RefineResult {
	refinedAnswer: string;
	usage: TokenUsage;
	routingDecision: {
		useProfileSignals: boolean;
		useSummaryFacts: boolean;
		useExperienceFacts: boolean;
		useJdFacts: boolean;
		reason: string;
	};
}

export async function refineFieldValue(
	input: RefineInput,
): Promise<RefineResult> {
	logger.info(
		{ fieldLabel: input.fieldLabel },
		"Refining field value with user instructions",
	);

	const { decision: routing, usage: routingUsage } =
		await routeRefineDataSources({
			fieldLabel: input.fieldLabel,
			fieldDescription: input.fieldDescription,
			existingAnswer: input.existingAnswer,
			userInstructions: input.userInstructions,
		});

	logger.debug({ routing }, "Routing decision");

	const context: RefineContext = {};
	if (routing.useProfileSignals) {
		context.profileSignals = input.profileSignals;
	}
	if (routing.useSummaryFacts) {
		context.summaryFacts = input.summaryFacts;
	}
	if (routing.useExperienceFacts) {
		context.experienceFacts = input.experienceFacts;
	}
	if (routing.useJdFacts) {
		context.jdFacts = input.jdFacts;
	}

	const { refinedAnswer, usage: writerUsage } = await writeRefinedAnswer({
		fieldLabel: input.fieldLabel,
		fieldDescription: input.fieldDescription,
		existingAnswer: input.existingAnswer,
		userInstructions: input.userInstructions,
		context,
	});

	const totalUsage: TokenUsage = {
		promptTokens: routingUsage.promptTokens + writerUsage.promptTokens,
		completionTokens:
			routingUsage.completionTokens + writerUsage.completionTokens,
		totalTokens: routingUsage.totalTokens + writerUsage.totalTokens,
		inputCost: (routingUsage.inputCost ?? 0) + (writerUsage.inputCost ?? 0),
		outputCost: (routingUsage.outputCost ?? 0) + (writerUsage.outputCost ?? 0),
		totalCost: (routingUsage.totalCost ?? 0) + (writerUsage.totalCost ?? 0),
	};

	logger.info({ usage: totalUsage }, "Refine total token usage");

	return { refinedAnswer, usage: totalUsage, routingDecision: routing };
}
