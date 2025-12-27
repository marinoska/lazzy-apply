import { openai } from "@ai-sdk/openai";
import type { TokenUsage } from "@lazyapply/types";
import { generateText } from "ai";
import { env } from "@/app/env.js";

export interface LlmCallResult<T> {
	result: T;
	usage: TokenUsage;
}

/**
 * Abstract base class for LLM services.
 * Provides shared logic for model invocation, usage calculation, and JSON parsing.
 *
 * @template TInput - The input type for the LLM call
 * @template TOutput - The parsed output type from the LLM response
 */
export abstract class BaseLlmService<TInput, TOutput> {
	/**
	 * Build the prompt string from the input
	 */
	protected abstract buildPrompt(input: TInput): string;

	/**
	 * Parse the LLM text response into the expected output type
	 */
	protected abstract parseResponse(text: string, input: TInput): TOutput;

	/**
	 * Temperature for the LLM call (0 = deterministic, higher = more creative)
	 */
	protected abstract get temperature(): number;

	/**
	 * Execute the LLM call with the given input
	 */
	async execute(input: TInput): Promise<LlmCallResult<TOutput>> {
		const prompt = this.buildPrompt(input);
		const { text, usage } = await this.callModel(prompt);
		const result = this.parseResponse(text, input);
		return { result, usage };
	}

	/**
	 * Call the OpenAI model and calculate token usage
	 */
	private async callModel(
		prompt: string,
	): Promise<{ text: string; usage: TokenUsage }> {
		const result = await generateText({
			model: openai(env.OPENAI_MODEL),
			prompt,
			temperature: this.temperature,
		});

		const usage = this.calculateUsage(result.usage);

		return { text: result.text, usage };
	}

	/**
	 * Calculate token usage and costs from raw usage data
	 */
	private calculateUsage(rawUsage: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	}): TokenUsage {
		const promptTokens = rawUsage.inputTokens ?? 0;
		const completionTokens = rawUsage.outputTokens ?? 0;
		const totalTokens = rawUsage.totalTokens ?? 0;
		const inputCost =
			(promptTokens / 1_000_000) * env.OPENAI_MODEL_INPUT_PRICE_PER_1M;
		const outputCost =
			(completionTokens / 1_000_000) * env.OPENAI_MODEL_OUTPUT_PRICE_PER_1M;
		const totalCost = inputCost + outputCost;

		return {
			promptTokens,
			completionTokens,
			totalTokens,
			inputCost,
			outputCost,
			totalCost,
		};
	}

	/**
	 * Parse JSON from LLM response, handling markdown code fences
	 */
	protected parseJsonFromMarkdown(text: string): unknown {
		let jsonText = text.trim();
		if (jsonText.startsWith("```")) {
			const lines = jsonText.split("\n");
			lines.shift();
			while (lines.length > 0 && lines[lines.length - 1].startsWith("```")) {
				lines.pop();
			}
			jsonText = lines.join("\n");
		}
		return JSON.parse(jsonText);
	}
}

/**
 * Create an empty token usage object
 */
export function createEmptyUsage(): TokenUsage {
	return {
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
		inputCost: 0,
		outputCost: 0,
		totalCost: 0,
	};
}
