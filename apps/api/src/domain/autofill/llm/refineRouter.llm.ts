import type { TokenUsage } from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
import { BaseLlmService } from "./base/baseLlmService.js";

const logger = createLogger("refine.router");

const REFINE_ROUTER_PROMPT = `
You decide which contextual data is REQUIRED to safely refine
a job application answer according to user instructions.

INPUT:
- Field label
- Field description
- Existing answer
- User instruction (may be empty)

AVAILABLE DATA SOURCES:
- profileSignals: high-level profile metadata (seniority, role scope, tech focus, work mode)
- summaryFacts: high-level CV facts
- experienceFacts: concrete past experience facts
- jdFacts: job role and requirements

TASK:
Select the MINIMAL set of data sources required to apply the user instruction
without inventing or overstating facts.

RULES:
- If the task is rephrasing, tone change, shortening, or clarity improvement,
  select NO data sources.
- Use profileSignals for high-level clarification only
  (seniority, scope, stack focus, work mode).
- If the task requires explaining fit, alignment, or motivation,
  select jdFacts and (profileSignals or summaryFacts).
- If the task requires concrete examples, details, or past work,
  select experienceFacts.
- Prefer profileSignals and summaryFacts over experienceFacts when possible.
- If unsure, select fewer data sources.
- Never select jdFacts unless at least one CV-backed source (profileSignals, summaryFacts, or experienceFacts) is also selected. 
jdFacts may only be used to prioritize or frame existing CV-supported information, never to introduce new skills or experience.

RETURN JSON ONLY:
{
  "useProfileSignals": boolean,
  "useSummaryFacts": boolean,
  "useExperienceFacts": boolean,
  "useJdFacts": boolean,
  "reason": string
}
`;

export interface RefineRouterInput {
	fieldLabel: string;
	fieldDescription: string;
	existingAnswer: string;
	userInstructions: string;
}

export interface RefineRoutingDecision {
	useProfileSignals: boolean;
	useSummaryFacts: boolean;
	useExperienceFacts: boolean;
	useJdFacts: boolean;
	reason: string;
}

class RefineRouterService extends BaseLlmService<
	RefineRouterInput,
	RefineRoutingDecision
> {
	protected get temperature(): number {
		return 0.1;
	}

	protected buildPrompt(input: RefineRouterInput): string {
		return `${REFINE_ROUTER_PROMPT}

Field Label:
${input.fieldLabel}

Field Description:
${input.fieldDescription || "(none)"}

Existing Answer:
${input.existingAnswer}

User Instruction:
${input.userInstructions || "(none)"}`;
	}

	protected parseResponse(text: string): RefineRoutingDecision {
		const parsed = this.parseJsonFromMarkdown(text);

		if (typeof parsed !== "object" || parsed === null) {
			throw new Error("LLM response is not a valid object");
		}

		const decision = parsed as Record<string, unknown>;

		if (
			typeof decision.useProfileSignals !== "boolean" ||
			typeof decision.useSummaryFacts !== "boolean" ||
			typeof decision.useExperienceFacts !== "boolean" ||
			typeof decision.useJdFacts !== "boolean" ||
			typeof decision.reason !== "string"
		) {
			throw new Error("LLM response missing required routing decision fields");
		}

		return {
			useProfileSignals: decision.useProfileSignals,
			useSummaryFacts: decision.useSummaryFacts,
			useExperienceFacts: decision.useExperienceFacts,
			useJdFacts: decision.useJdFacts,
			reason: decision.reason,
		};
	}
}

const refineRouterService = new RefineRouterService();

export async function routeRefineDataSources(
	input: RefineRouterInput,
): Promise<{ decision: RefineRoutingDecision; usage: TokenUsage }> {
	logger.info({ fieldLabel: input.fieldLabel }, "Routing refine data sources");

	const { result: decision, usage } = await refineRouterService.execute(input);

	logger.info(
		{
			decision,
			usage,
		},
		"Routing decision completed",
	);

	return { decision, usage };
}
