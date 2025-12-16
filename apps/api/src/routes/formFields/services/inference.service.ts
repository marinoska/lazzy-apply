import { openai } from "@ai-sdk/openai";
import type { TokenUsage } from "@lazyapply/types";
import { generateText } from "ai";
import { env } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";

const logger = createLogger("inference.service");

const INFERENCE_PROMPT = `You generate answers for job application form fields.

INPUT:
- CV: raw text of the candidate CV
- JD: raw text of the job description (may be empty)
- Fields: a list of form fields, each with a unique hash and a label

TASK:
For each field:
- Generate a concise, professional answer
- Base the answer on the CV
- Use the JD only if it is provided and relevant
- Do not invent experience not supported by the CV
- If JD is empty, rely only on CV
- Each answer must be independent
- The answer must directly address the intent of the field.
- If the field asks "why", the answer must explain motivation or alignment, not list skills alone.
- If the field asks "how" or "what", respond accordingly and do not shift intent.

RETURN JSON ONLY.

OUTPUT FORMAT:
{
  "answers": {
    "<fieldHash>": "<generated text>"
  }
}

RULES:
- Do not include explanations
- Do not include field labels in the answer
- Do not reference the CV or JD explicitly
- Never use the long dash character "—". Use "-" instead.
- Base all answers strictly on the CV content. Use the JD only if provided and only to adjust wording or emphasis when the CV already clearly supports the claim.
- Do not introduce new skills, responsibilities, experience, preferences, seniority, availability, motivation, or intent from the JD or from assumptions.
- Do not infer or upgrade specialization, primary focus, deep expertise, leadership, ownership, seniority, or mastery unless explicitly stated in the CV using equivalent wording (e.g., "specialized in", "primary focus", "expert in", "led as").
- If something is mentioned only as experience, exposure, or participation, describe it using neutral wording such as "experience with", "worked on", or "was involved in".
- Do not upgrade participation into ownership, collaboration into leadership, or exposure into expertise unless clearly supported by the CV.
- Do not elevate the frequency, depth, importance, or recency of any skill, responsibility, or achievement beyond what is explicitly supported by the CV.
- Do not assume soft skills, personal traits, motivations, career goals, availability, or preferences unless explicitly stated in the CV.
- Do not invent, estimate, or extrapolate metrics, scale, impact, outcomes, or results. If the CV does not provide numbers, keep descriptions qualitative and factual.
- Do not smooth over or reinterpret career gaps, transitions, role changes, or continuity. Do not imply progression or stability unless explicitly stated.
- Avoid absolute, promotional, or peak terms such as "expert", "highly specialized", "industry-leading", "deep expertise", or "extensive mastery" unless explicitly stated in the CV.
- If the CV does not clearly support a response, generate a minimal, factual answer without extrapolation.
- When uncertain, always choose the least assumptive, least promotional, and most conservative wording.
- Do not list all skills, tools, or technologies from the CV.
- Prioritize items that are most relevant to the most recent roles and responsibilities.
- De-emphasize or omit older, legacy, or less relevant items when more recent experience indicates a different focus.
- Order items by relevance and recency, not by their order of appearance in the CV.
- When summarizing skills or experience, prefer a focused subset over exhaustive lists.
- When explaining interest or motivation, base it only on explicit alignment between the CV experience and the role or company context provided in the JD.
- Do not invent personal passion, enthusiasm, or emotional attachment not supported by the CV or JD.
- Do not list technologies, tools, or frameworks unless they directly support the stated motivation.
- Avoid enumerations in motivation or interest fields.
- When a company or product is mentioned in the field, reference it only at a high level and only if supported by the JD.
- Do not invent knowledge about the company beyond what is stated in the JD.
- Do not reference specific projects, roles, or achievements from the CV unless they are directly relevant to the field's intent.
- Avoid generic or templated responses. When explaining motivation or fit, include at least one concrete aspect of the role or product described in the JD, if available and supported by the CV.
- For "why" questions, the answer must explicitly state a reason for interest or alignment (e.g., "because", "as it allows me to", "which aligns with", "as it gives me the opportunity to").
- Answers that only describe background, experience, or skills without stating a reason are invalid.
- A valid answer to a "why" question must include at least one sentence that connects past experience to a future opportunity or motivation.
`;

export interface InferenceField {
	hash: string;
	fieldName: string | null;
}

export interface InferenceInput {
	cvRawText: string;
	jdRawText: string;
	fields: InferenceField[];
}

export interface InferenceResult {
	answers: Record<string, string>;
	usage: TokenUsage;
}

interface InferenceResponse {
	answers: Record<string, string>;
}

function buildInferencePrompt(input: InferenceInput): string {
	const fieldsJson = input.fields.map((f) => ({
		hash: f.hash,
		label: f.fieldName,
	}));

	return `${INFERENCE_PROMPT}

CV:
${input.cvRawText}

JD:
${input.jdRawText || "(empty)"}

Fields:
${JSON.stringify(fieldsJson, null, 2)}`;
}

function parseInferenceResponse(text: string): Record<string, string> {
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

	if (typeof parsed !== "object" || parsed === null || !("answers" in parsed)) {
		throw new Error("LLM response does not contain answers object");
	}

	const response = parsed as InferenceResponse;

	if (typeof response.answers !== "object" || response.answers === null) {
		throw new Error("LLM response answers is not an object");
	}

	return response.answers;
}

/**
 * Infers field values using CV and JD text via a single LLM call
 * Stateless service - no retries, no chat history
 */
export async function inferFieldValues(
	input: InferenceInput,
): Promise<InferenceResult> {
	if (input.fields.length === 0) {
		return { answers: {}, usage: createEmptyUsage() };
	}

	const prompt = buildInferencePrompt(input);

	logger.info(
		{ fieldCount: input.fields.length },
		"Inferring field values from CV and JD",
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

	logger.info({ usage }, "Inference token usage");

	const answers = parseInferenceResponse(result.text);

	return { answers, usage };
}

function createEmptyUsage(): TokenUsage {
	return {
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
		inputCost: 0,
		outputCost: 0,
		totalCost: 0,
	};
}
