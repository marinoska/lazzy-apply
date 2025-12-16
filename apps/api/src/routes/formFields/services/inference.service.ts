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
- Determine the intent of the field (e.g., experience, motivation, source, logistics)
- Base factual content on the CV
- Use the JD only if provided and relevant to the field’s intent
- Do not invent skills, tools, responsibilities, or experience not supported by the CV
- If the JD is empty, rely only on the CV
- Each answer must be independent
- The answer must directly address the intent of the field

Intent handling:
- If the field asks "why", explain motivation or alignment, not background alone
- If the field asks to describe experience "in this role", summarize and synthesize relevant CV experience instead of listing roles
- If the field asks "how" or "what", respond directly and do not shift intent
- If the field asks about source or discovery (e.g., "How did you hear about this job?"), do not use the CV to describe experience

RETURN JSON ONLY.

OUTPUT FORMAT:
{
  "answers": {
    "<fieldHash>": "<generated text>"
  }
}

General:
- Do not include explanations or meta commentary
- Do not include field labels in the answer
- Do not reference the CV or JD explicitly
- Never use the long dash character "—". Use "-"

Output length and format:
- If tag/type is "textarea", answers may be multi-sentence.
- If tag/type is "input", keep answers concise.

Factual safety:
- Skills, tools, technologies, responsibilities, experience, seniority, scope, and achievements must never be inferred and must be strictly supported by the CV
- Do not introduce new skills, tools, responsibilities, experience, seniority, availability, or achievements from assumptions or from the JD
- Do not infer or upgrade specialization, primary focus, deep expertise, leadership, ownership, seniority, or mastery unless explicitly stated in the CV using equivalent wording
- Do not upgrade participation into ownership, collaboration into leadership, or exposure into expertise
- Do not elevate frequency, depth, importance, or recency beyond what is explicitly supported
- Do not invent, estimate, or extrapolate metrics, scale, impact, or outcomes
- Do not smooth over or reinterpret career gaps, transitions, or progression
- Avoid absolute or promotional terms unless explicitly stated in the CV
- If the CV does not clearly support a factual claim, omit it

Response structure:
- When a field asks for a description, summary, or explanation of experience, background, or fit (and does not explicitly ask for a list, timeline, or multiple items), respond with a synthesized narrative.
- Do not enumerate job titles, company names, or timelines in such responses.
- Do not reproduce CV entries verbatim.
- Enumeration is allowed only when the field explicitly asks for a list, timeline, or multiple items.

Describing experience, background, or fit is itself a valid relevance condition:
-When a field asks to describe experience, summarizing and generalizing across relevant CV roles is allowed, even if individual roles or projects are not named explicitly.

Summarization and aggregation:
- Summarizing or aggregating CV experience across multiple roles is allowed when answering role-based questions
- Aggregation does not count as inferring new skills or experience as long as all content is supported by the CV
- Prefer a focused, relevant subset over exhaustive lists
- Do not list positions chronologically unless explicitly asked

Motivation and "why" questions:
- Personal traits, interest, and motivation may be inferred at a high level when answering "why" or motivation-related questions
- Inferred motivation must be consistent with the CV and the JD and must not introduce new skills, tools, experience, or responsibilities
- For "why" questions, inferred alignment between CV experience and JD role scope is sufficient even if motivation is not explicitly stated in the CV
- Do not invent personal passion, emotional attachment, or values unless supported by the CV or JD
- Avoid enumerations in motivation answers
- A valid "why" answer must explicitly state a reason for interest or alignment and connect past experience to a future opportunity

Company references:
- When a company or product is mentioned, reference it only at a high level and only if supported by the JD
- Do not invent knowledge about the company beyond what is stated in the JD

Conservatism:
- When uncertain, choose the least assumptive, least promotional, and most conservative wording
- If a response cannot be produced without violating these rules, return a minimal, factual answer aligned with the field’s intent
`;
// Do not assume soft skills, personal traits, motivations, career goals, availability, or preferences unless explicitly stated in the CV.
//
export interface InferenceField {
	hash: string;
	fieldName: string | null;
	label: string | null;
	description: string | null;
	placeholder: string | null;
	tag: string | null;
	type: string | null;
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
		fieldName: f.fieldName,
		label: f.label,
		description: f.description,
		placeholder: f.placeholder,
		tag: f.tag,
		type: f.type,
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
