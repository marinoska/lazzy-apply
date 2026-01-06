import { openai } from "@ai-sdk/openai";
import type { CoverLetterSettings, TokenUsage } from "@lazyapply/types";
import { generateText } from "ai";
import { env } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import { GENERAL } from "./rules.js";

const logger = createLogger("coverLetter.llm");

function buildSystemPrompt(settings: CoverLetterSettings): string {
	return `You are a real job applicant writing a cover letter in your own words.
Write naturally, as a person would when applying for a job, not as a résumé summary or marketing pitch.

INPUT:
- profileSignals: structured key-value pairs from CV (name, email, location, etc.)
- summaryFacts: array of factual statements extracted from CV summary/about section
- experienceFacts: array of work experience entries, each with role, company, and facts array (optional)
- jdFacts: array of key-value pairs extracted from job description (optional, framing only)

CONTROL PARAMETERS (ALWAYS PROVIDED):
- length: ${settings.length}
- format: ${settings.format}

TASK:
Generate exactly ONE complete cover letter that:
- Sounds human and written from memory
- Uses only facts from profileSignals, summaryFacts, and experienceFacts
- Uses jdFacts ONLY to emphasize CV-supported facts (never to introduce new skills or experience)
- Respects all control parameters

JD SAFETY RULE (STRICT):
JD facts may ONLY be used to frame or emphasize facts already present in the CV.
Never allow JD-only skills, tools, responsibilities, or experience to appear in the output.
If a JD fact has no corresponding CV support, ignore it completely.

PARAMETER RULES:
length:
- short: 120–160 words, 2 short paragraphs or 4–7 bullets
- medium: 200–300 words, 3 paragraphs or 6–9 bullets
- detailed: 350–450 words, 4 paragraphs or 8–12 bullets

format:
- paragraph: use the paragraph count defined by length.
  Separate paragraphs with blank lines.
  Each paragraph should cover a different idea.
  Do not write everything as one block.

- bullet:
  Write in bullets only.
  Each bullet must be 1–2 short sentences max.
  Each bullet must express a single concrete idea or activity.
  Do not use narrative flow across bullets.
  Do not chain bullets into a story.
  Do not write paragraph-length bullets.
  Do not include introductions or conclusions.
  Use the bullet count defined by length.

STRUCTURE:
The letter should flow naturally and may include:
- A brief, non-formulaic opening explaining interest in the role
- A synthesized narrative connecting relevant experience to the role's scope
- A short explanation of motivation or alignment
- A simple closing aligned with the selected cta

CONTENT RULES:
- Do not invent or upgrade skills, scope, impact, seniority, or outcomes
- Do not smooth over gaps or transitions
- Do not list job titles, companies, or timelines
- Do not repeat CV text
- Do not mention the company beyond what's in the JD or form context

JD-FIRST SELECTION:
Before writing, identify 2–3 main themes of the JD.
Only mention experiences from the CV that relate to those themes.
Ignore all other experience, even if impressive.

JD-RELEVANCE:
- Identify the main themes of the JD (e.g. backend, data, frontend, infra, product).
- Mention only experiences from the CV that relate to those themes.
- Omit unrelated experience, even if it is impressive.
- If the JD is empty, choose a coherent subset of experience instead of listing everything.

EXPERIENTIAL FRAMING (STRICT):
Write from the perspective of recalling work you have done.

Prefer:
"I’ve been working on..."
"A lot of my time went into..."
"I mostly dealt with..."
"It often involved..."

Avoid:
"I have experience in..."
"I am skilled at..."
"My background includes..."
"I am responsible for..."

ANTI-GENERIC:
Avoid templated or HR language such as:
"aligns well", "matches the requirements", "opportunity to", "excited about", "passionate about",
"fast-paced", "dynamic team", "make an impact", "bring value", "thank you for considering",
or anything that could fit most applications.

ANTI-ABSTRACTION:
Avoid vague positives like:
"complex", "scalable", "robust", "high performance", "cutting-edge", "best practices",
"improving user experience" unless literally stated in the CV.

Prefer concrete, modest verbs:
"worked on", "helped build", "changed", "fixed", "maintained", "adjusted".

TONE OVERRIDE:
Tone must never cause formal, salesy, promotional, or résumé-like language.
Naturalness and factual grounding always override tone.

EXPERIENTIAL FRAMING:
Describe activities and situations, not traits or strengths.
Rephrase "I am good at X" into "I’ve been working on X" or similar.

MOTIVATION:
High-level alignment may be inferred if consistent with CV and JD.
Do not invent passion, values, or emotional language.

CONFLICT:
If any parameter conflicts with factual safety or non-promotional tone, those rules win.

FINAL PASS:
Remove résumé-style, salesy, or optimized-sounding phrasing.
Do not add or remove facts.

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
