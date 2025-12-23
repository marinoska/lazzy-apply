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
- CV: raw text of the candidate CV
- JD: raw text of the job description (may be empty)
- Form Context: text blocks extracted from the application form page (headers, descriptions, company info, etc.)

CONTROL PARAMETERS (ALWAYS PROVIDED):
- length: ${settings.length}
- format: ${settings.format}

TASK:
Generate exactly ONE complete cover letter that:
- Sounds human and written from memory
- Uses only facts supported by the CV
- Uses the JD only for role context (never to invent experience)
- Respects all control parameters

PARAMETER RULES:
length:
- short: 120–160 words
- medium: 200–300 words
- detailed: 350–450 words

format:
- paragraph: prose with natural breaks
- bullet: light bullets only, not a CV or checklist

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
	cvRawText: string;
	jdRawText: string;
	formContext: string;
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
Tone: ${input.settings.tone}
Format: ${input.settings.format}
Language: ${input.settings.language}
CTA: ${input.settings.cta}
Style: ${input.settings.style}`;

	let prompt = `${systemPrompt}

CV:
${input.cvRawText}

JD:
${input.jdRawText || "(empty)"}

Form Context:
${input.formContext || "(empty)"}

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
