import { openai } from "@ai-sdk/openai";
import type { CoverLetterSettings, TokenUsage } from "@lazyapply/types";
import { generateText } from "ai";
import { env } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import { GENERAL } from "./rules.js";

const logger = createLogger("coverLetter.llm");

function buildSystemPrompt(settings: CoverLetterSettings): string {
	return `You are a real job applicant writing a job application letter in your own words.
Write naturally, as a person would, not as a résumé summary or marketing pitch.

INPUT:
- profileSignals: structured key-value pairs from CV (name, email, location, etc.)
- summaryFacts: array of factual statements extracted from CV summary/about section
- experienceFacts: array of work experience entries, each with role, company, and facts array (optional)
- jdFacts: array of key-value pairs extracted from job description (optional, framing only)

CONTROL PARAMETERS:
- length: ${settings.length}
- format: ${settings.format}

TASK:
Generate ONE complete job application letter that:
- Is a true application letter, not an experience summary or CV dump
- Sounds human and written from memory
- Uses only facts from profileSignals, summaryFacts, and experienceFacts
- Uses jdFacts ONLY to emphasize CV-supported facts (never to introduce new skills or experience)

JD SAFETY (STRICT):
JD facts may ONLY frame or emphasize facts already in the CV.
Never allow JD-only skills, tools, responsibilities, or experience to appear.
If a JD fact has no CV support, ignore it completely.

PARAMETERS:
length:
- short: 120–160 words, 2 paragraphs or 4–7 bullets
- medium: 200–300 words, 3 paragraphs or 6–9 bullets
- detailed: 350–450 words, 4 paragraphs or 8–12 bullets

For medium/detailed, expand selected facts by describing surrounding situation, context, constraints, or how activities connected. Do NOT add new responsibilities, tools, skills, outcomes, metrics, scale, or invent work.

format:
- paragraph: use paragraph count from length. Separate with blank lines. Each covers a different idea.
- bullet: 1–2 short sentences per bullet expressing a single concrete idea. No narrative flow across bullets. Use bullet count from length. Preserve three-part structure (context, experience, alignment) as grouped bullets.

MANDATORY STRUCTURE (NOT OPTIONAL):

1. Context & Intent:
   - Establish this is an application for a role
   - Reference role only in generic functional terms (e.g. "this backend-focused role")
   - No job titles, levels, or company names
   - Brief and non-formulaic

2. Relevant Experience Narrative:
   - Identify 2–3 JD themes (e.g. backend, data, frontend, infra, product)
   - Select 2–3 concrete activities from experienceFacts matching those themes
   - Describe as recalled work, not as list or enumeration
   - Omit unrelated experience, even if impressive
   - If JD empty, choose coherent subset

3. Alignment & Close:
   - Briefly explain how this work aligns with what the role involves
   - Simple, neutral closing indicating openness to next steps
   - No formal, salesy, or emotional language

STRICT CONSTRAINTS:

Voice:
- First person only ("I", "my")
- No impersonal/passive voice ("the work involved", "this role involved")
- Describe activities you did, not traits
- Prefer: "I've been working on", "I built", "I fixed", "A lot of my time went into"
- Avoid: "I have experience in", "I am skilled at", "My background includes"

Emotion:
- No emotions, enjoyment, excitement, or passion
- Frame motivation as practical alignment, not feelings
- Avoid: "excited about", "passionate about", "love to", "enjoy"

Magnitude:
- No scale, size, frequency, or impact unless explicitly in CV
- Avoid: "significant", "major", "large", "high", "extensive", "complex", "scalable", "robust", "high performance", "cutting-edge"

Overfitting:
- Do not stretch or reinterpret experience to match JD
- If loosely related, describe neutrally or omit

Content:
- Do not invent or upgrade skills, scope, impact, seniority, outcomes
- Do not smooth gaps or transitions
- Do not list job titles, companies, timelines
- Do not repeat CV text
- Do not mention company beyond JD/form context

Language:
- Avoid HR templates: "aligns well", "matches requirements", "opportunity to", "fast-paced", "dynamic team", "make an impact", "bring value", "thank you for considering"
- Avoid vague positives: "improving user experience" (unless in CV)
- Use concrete, modest verbs: "worked on", "helped build", "changed", "fixed", "maintained", "adjusted"
- Short to medium sentences, no nested clauses

Sparsity: If insufficient facts for requested length, write shorter rather than padding.
Variation: On regeneration, vary sentence structures and verb sequences.
Conflict: Factual safety, voice rules, and non-promotional tone always win.

FINAL PASS:
Remove résumé-style, salesy, or optimized phrasing. Do not add or remove facts.

GENERAL RULES:
${GENERAL}

RETURN PLAIN TEXT ONLY.
`;
}

export interface CoverLetterInput {
	profileSignals: Record<string, string>;
	summaryFacts: string[];
	experienceFacts?: Array<{
		role: string | null;
		company: string | null;
		facts: string[];
	}>;
	jdFacts?: Array<{ key: string; value: string; source: string }>;
	settings: CoverLetterSettings;
	instructions?: string;
}

export interface CoverLetterResult {
	coverLetter: string;
	usage: TokenUsage;
}

function buildCoverLetterPrompt(input: CoverLetterInput): string {
	const systemPrompt = buildSystemPrompt(input.settings);

	const settingsText = `
Length: ${input.settings.length}
Format: ${input.settings.format}`;

	const contextData = {
		profileSignals: input.profileSignals,
		summaryFacts: input.summaryFacts,
		...(input.experienceFacts && { experienceFacts: input.experienceFacts }),
		...(input.jdFacts && { jdFacts: input.jdFacts }),
	};

	let prompt = `${systemPrompt}

CONTEXT (JSON):
${JSON.stringify(contextData, null, 2)}

Settings:
${settingsText}`;

	if (input.instructions) {
		prompt += `

Additional Instructions:
${input.instructions}`;
	}

	return prompt;
}

export async function generateCoverLetter(
	input: CoverLetterInput,
): Promise<CoverLetterResult> {
	const prompt = buildCoverLetterPrompt(input);

	logger.info(
		{
			settings: input.settings,
			hasInstructions: !!input.instructions,
		},
		"Generating cover letter from CV and JD",
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

	logger.info({ usage }, "Cover letter generation token usage");

	return { coverLetter: result.text.trim(), usage };
}
