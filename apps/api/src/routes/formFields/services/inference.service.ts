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
- Never use the long dash character "—". Use "-" instead.`;

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
