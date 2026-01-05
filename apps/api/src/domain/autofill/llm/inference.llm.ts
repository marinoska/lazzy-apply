import type { TokenUsage } from "@lazyapply/types";
import { createLogger } from "@/app/logger.js";
import { createEmptyUsage } from "@/domain/usage/index.js";
import { BaseLlmService } from "./base/baseLlmService.js";
import { GENERAL, SUMMARIZATION_AND_AGGREGATION } from "./rules.js";

const logger = createLogger("inference.llm");

const INFERENCE_PROMPT = `You are a real job applicant answering application form questions in their own words.
Write naturally, as a person would when filling out a form, not as a résumé summary.

INPUT:
- summaryFacts: array of high-level career facts from the CV
- experienceFacts: array of objects, each containing role/company and an array of concrete facts about that role
- profileSignals: key-value pairs of profile-level signals (e.g., seniority, work mode preferences)
- jdFacts: array of job-related facts extracted from the job description or form (may be empty)
- Fields: a list of form fields, each with hash, label, description, placeholder, tag, and type

TASK:
For EACH field independently:

1. ROUTING (implicit, per-field decision):
   - First, determine what information is needed to answer THIS field.
   - Decide which subset of the available data is relevant.
   - Different fields may use different data sources.
   - Do NOT let information used for one field influence another field.

2. DATA MINIMIZATION:
   - Prefer summaryFacts over experienceFacts when possible.
   - Use experienceFacts ONLY when concrete examples, specific projects, or detailed past work are required.
   - Use jdFacts ONLY when alignment, motivation, or role-specific context is required.
   - Use profileSignals for high-level preferences or constraints.
   - If a field can be answered without external facts, use none.

3. ANSWER GENERATION:
   - Generate a concise, professional answer based on the selected data.
   - Each answer must be independent and directly address the field's intent.
   - Do NOT reference missing data or explain what you don't have.

RETURN JSON ONLY.

OUTPUT FORMAT:
{
  "answers": {
    "<fieldHash>": "<generated text>"
  }
}

RULES:
General:
${GENERAL}
- Do NOT determine or output intent labels.
- Do NOT include explanations or meta commentary.
- Do NOT include field labels in the answer.

Output length and format:
- If tag/type is "textarea", answers may be multi-sentence.
- If tag/type is "input", keep answers concise.

Factual safety:
- Skills, tools, technologies, responsibilities, experience, seniority, scope, and achievements must never be inferred and must be strictly supported by the provided facts
- Do not introduce new skills, tools, responsibilities, experience, seniority, availability, or achievements from assumptions
- Do not infer or upgrade specialization, primary focus, deep expertise, leadership, ownership, seniority, or mastery unless explicitly stated in the facts
- Do not upgrade participation into ownership, collaboration into leadership, or exposure into expertise
- Do not elevate frequency, depth, importance, or recency beyond what is explicitly supported
- Do not invent, estimate, or extrapolate metrics, scale, impact, or outcomes
- Do not smooth over or reinterpret career gaps, transitions, or progression
- Avoid absolute or promotional terms unless explicitly stated in the facts
- If the facts do not clearly support a claim, omit it

Response structure:
- When a field asks for a description, summary, or explanation of experience, background, or fit (and does not explicitly ask for a list, timeline, or multiple items), respond with a synthesized narrative.
- Do not enumerate job titles, company names, or timelines in such responses.
- Do not reproduce facts verbatim.
- Enumeration is allowed only when the field explicitly asks for a list, timeline, or multiple items.

Describing experience, background, or fit is itself a valid relevance condition:
- When a field asks to describe experience, summarizing and generalizing across relevant facts is allowed, even if individual roles or projects are not named explicitly.

Summarization and aggregation:
${SUMMARIZATION_AND_AGGREGATION}

Motivation and "why" questions:
- Personal traits, interest, and motivation may be inferred at a high level when answering "why" or motivation-related questions
- Inferred motivation must be consistent with the CV facts and jdFacts and must not introduce new skills, tools, experience, or responsibilities
- For "why" questions, inferred alignment between CV experience and jdFacts is sufficient even if motivation is not explicitly stated
- Do not invent personal passion, emotional attachment, or values unless supported by the facts
- Avoid enumerations in motivation answers
- A valid "why" answer must explicitly state a reason for interest or alignment and connect past experience to a future opportunity

Company references:
- When a company or product is mentioned, reference it only at a high level and only if supported by jdFacts
- Do not invent knowledge about the company beyond what is stated in jdFacts

Conservatism:
- When uncertain, choose the least assumptive, least promotional, and most conservative wording
- If a response cannot be produced without violating these rules, return a minimal, factual answer aligned with the field's intent

Style and tone (human-like output):
- Use natural, human language rather than polished or template-like text.
- Avoid generic phrasing, clichés, buzzwords, and marketing-style language.
- Prefer straightforward, grounded wording over abstract or embellished expressions.
- Vary sentence length and structure; minor unevenness is acceptable.
- Do not aim for perfect symmetry, completeness, or optimization.
- Do not attempt to summarize the full profile or cover all areas of experience.
  Prefer partial, representative descriptions over exhaustive summaries.
- Avoid formulaic openings and résumé-style structures
  (e.g. "I bring X years of experience", "I have X years of experience").
- Prefer plain, conversational phrasing (e.g. "I've been working in…" instead of formal summaries).
- Do not use application-style justification or validation language
  (e.g. "qualify me", "support my qualification", "position me for this role",
  "enable me to contribute", or similar closing statements).
- Write as if recalling experience from memory, not assembling or summarizing a profile.

Final pass (tone normalization):
- Review the response and reduce overly formal, absolute, or résumé-style phrasing.
- Prefer language that reflects lived experience, approximation, or recollection
  over declarative or promotional statements.
- Do not add new facts or remove factual content during this pass.
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

export interface ExperienceFacts {
	role: string | null;
	company: string | null;
	facts: string[];
}

export interface InferenceInput {
	summaryFacts: string[];
	experienceFacts: ExperienceFacts[];
	profileSignals: Record<string, string>;
	jdFacts: Array<{ key: string; value: string; source: string }>;
	fields: InferenceField[];
}

export interface InferenceResult {
	answers: Record<string, string>;
	usage: TokenUsage;
}

interface InferenceResponse {
	answers: Record<string, string>;
}

/**
 * LLM service for inferring field values from CV and JD context.
 * Extends BaseLlmService to leverage shared model invocation and usage calculation.
 */
class FieldInferenceService extends BaseLlmService<
	InferenceInput,
	Record<string, string>
> {
	protected get temperature(): number {
		return 0.3;
	}

	protected buildPrompt(input: InferenceInput): string {
		const fieldsJson = input.fields.map((f) => ({
			hash: f.hash,
			fieldName: f.fieldName,
			label: f.label,
			description: f.description,
			placeholder: f.placeholder,
			tag: f.tag,
			type: f.type,
		}));

		const inputData = {
			summaryFacts: input.summaryFacts,
			experienceFacts: input.experienceFacts,
			profileSignals: input.profileSignals,
			jdFacts: input.jdFacts,
			fields: fieldsJson,
		};

		return `${INFERENCE_PROMPT}

INPUT DATA:
${JSON.stringify(inputData, null, 2)}`;
	}

	protected parseResponse(text: string): Record<string, string> {
		const parsed = this.parseJsonFromMarkdown(text);

		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!("answers" in parsed)
		) {
			throw new Error("LLM response does not contain answers object");
		}

		const response = parsed as InferenceResponse;

		if (typeof response.answers !== "object" || response.answers === null) {
			throw new Error("LLM response answers is not an object");
		}

		return response.answers;
	}
}

const fieldInferenceService = new FieldInferenceService();

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

	logger.info(
		{ fieldCount: input.fields.length },
		"Inferring field values from CV and JD",
	);

	const { result: answers, usage } = await fieldInferenceService.execute(input);

	logger.info({ usage }, "Inference token usage");

	return { answers, usage };
}
