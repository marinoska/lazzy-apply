import { describe, expect, it, vi } from "vitest";

// Mock the AI SDK and env before importing the module
vi.mock("@ai-sdk/openai", () => ({
	openai: vi.fn(() => "mocked-model"),
}));

vi.mock("ai", () => ({
	generateText: vi.fn(),
}));

vi.mock("@/app/env.js", () => ({
	env: {
		OPENAI_MODEL: "gpt-4",
		OPENAI_MODEL_INPUT_PRICE_PER_1M: 10,
		OPENAI_MODEL_OUTPUT_PRICE_PER_1M: 30,
	},
}));

vi.mock("@/app/logger.js", () => ({
	createLogger: () => ({
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	}),
}));

// Import after mocks are set up
import { generateText } from "ai";
import { inferFieldValues } from "./inference.llm.js";

const mockedGenerateText = vi.mocked(generateText);

describe("inference.llm", () => {
	describe("inferFieldValues", () => {
		it("should return empty answers for empty fields array", async () => {
			const result = await inferFieldValues({
				cvRawText: "Some CV text",
				jdRawText: "Some JD text",
				fields: [],
			});

			expect(result.answers).toEqual({});
			expect(result.usage.totalTokens).toBe(0);
			expect(mockedGenerateText).not.toHaveBeenCalled();
		});

		it("should call LLM and return parsed answers", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({
					answers: {
						"hash-1": "I am excited about this role because...",
					},
				}),
				usage: {
					inputTokens: 500,
					outputTokens: 100,
					totalTokens: 600,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await inferFieldValues({
				cvRawText: "John Doe, Software Engineer with 5 years experience",
				jdRawText: "Looking for a senior developer",
				fields: [
					{
						hash: "hash-1",
						fieldName: "Why do you want this role?",
						label: null,
						description: null,
						placeholder: null,
						tag: null,
						type: null,
					},
				],
			});

			expect(result.answers).toEqual({
				"hash-1": "I am excited about this role because...",
			});
			expect(result.usage.totalTokens).toBe(600);
		});

		it("should handle markdown code blocks in response", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: `\`\`\`json
{
  "answers": {
    "hash-1": "Generated answer"
  }
}
\`\`\``,
				usage: {
					inputTokens: 500,
					outputTokens: 100,
					totalTokens: 600,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await inferFieldValues({
				cvRawText: "CV text",
				jdRawText: "",
				fields: [
					{
						hash: "hash-1",
						fieldName: "Question",
						label: null,
						description: null,
						placeholder: null,
						tag: null,
						type: null,
					},
				],
			});

			expect(result.answers).toEqual({
				"hash-1": "Generated answer",
			});
		});

		it("should handle empty JD text", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({
					answers: {
						"hash-1": "Answer based on CV only",
					},
				}),
				usage: {
					inputTokens: 300,
					outputTokens: 50,
					totalTokens: 350,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await inferFieldValues({
				cvRawText: "CV text",
				jdRawText: "",
				fields: [
					{
						hash: "hash-1",
						fieldName: "Question",
						label: null,
						description: null,
						placeholder: null,
						tag: null,
						type: null,
					},
				],
			});

			expect(result.answers["hash-1"]).toBe("Answer based on CV only");
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("(empty)"),
				}),
			);
		});

		it("should throw error for invalid response format", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ invalid: "format" }),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			await expect(
				inferFieldValues({
					cvRawText: "CV text",
					jdRawText: "JD text",
					fields: [
						{
							hash: "hash-1",
							fieldName: "Question",
							label: null,
							description: null,
							placeholder: null,
							tag: null,
							type: null,
						},
					],
				}),
			).rejects.toThrow("LLM response does not contain answers object");
		});

		it("should include field labels in the prompt", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ answers: {} }),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			await inferFieldValues({
				cvRawText: "CV text",
				jdRawText: "JD text",
				fields: [
					{
						hash: "hash-1",
						fieldName: "Why do you want this role?",
						label: null,
						description: null,
						placeholder: null,
						tag: null,
						type: null,
					},
					{
						hash: "hash-2",
						fieldName: "Describe your experience",
						label: null,
						description: null,
						placeholder: null,
						tag: null,
						type: null,
					},
				],
			});

			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("Why do you want this role?"),
				}),
			);
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("Describe your experience"),
				}),
			);
		});
	});
});
