import { describe, expect, it, vi } from "vitest";

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

import { generateText } from "ai";
import { refineFieldValue } from "./refine.llm.js";

const mockedGenerateText = vi.mocked(generateText);

describe("refine.llm", () => {
	describe("refineFieldValue", () => {
		it("should call LLM and return refined answer", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({
					refinedAnswer: "John Michael Doe",
				}),
				usage: {
					inputTokens: 500,
					outputTokens: 100,
					totalTokens: 600,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await refineFieldValue({
				cvRawText: "John Doe, Software Engineer with 5 years experience",
				fieldLabel: "Full Name",
				fieldDescription: "Please enter your full name",
				existingAnswer: "John Doe",
				userInstructions: "Use my middle name",
			});

			expect(result.refinedAnswer).toBe("John Michael Doe");
			expect(result.usage.totalTokens).toBe(600);
			expect(result.usage.inputCost).toBe(0.005);
			expect(result.usage.outputCost).toBe(0.003);
			expect(result.usage.totalCost).toBe(0.008);
		});

		it("should handle markdown code blocks in response", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: `\`\`\`json
{
  "refinedAnswer": "Refined text here"
}
\`\`\``,
				usage: {
					inputTokens: 400,
					outputTokens: 80,
					totalTokens: 480,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await refineFieldValue({
				cvRawText: "CV text",
				fieldLabel: "Experience",
				fieldDescription: "Describe your experience",
				existingAnswer: "Original text",
				userInstructions: "Make it shorter",
			});

			expect(result.refinedAnswer).toBe("Refined text here");
		});

		it("should include all input fields in the prompt", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ refinedAnswer: "Result" }),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			await refineFieldValue({
				cvRawText: "My CV content",
				fieldLabel: "Why this role?",
				fieldDescription: "Explain your motivation",
				existingAnswer: "I like coding",
				userInstructions: "Be more specific",
			});

			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("My CV content"),
				}),
			);
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("Why this role?"),
				}),
			);
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("Explain your motivation"),
				}),
			);
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("I like coding"),
				}),
			);
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("Be more specific"),
				}),
			);
		});

		it("should handle empty field description", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ refinedAnswer: "Result" }),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await refineFieldValue({
				cvRawText: "CV text",
				fieldLabel: "Name",
				fieldDescription: "",
				existingAnswer: "John",
				userInstructions: "Add surname",
			});

			expect(result.refinedAnswer).toBe("Result");
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("(none)"),
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
				refineFieldValue({
					cvRawText: "CV text",
					fieldLabel: "Label",
					fieldDescription: "Description",
					existingAnswer: "Answer",
					userInstructions: "Instructions",
				}),
			).rejects.toThrow("LLM response does not contain refinedAnswer field");
		});

		it("should throw error when refinedAnswer is not a string", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ refinedAnswer: 123 }),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			await expect(
				refineFieldValue({
					cvRawText: "CV text",
					fieldLabel: "Label",
					fieldDescription: "Description",
					existingAnswer: "Answer",
					userInstructions: "Instructions",
				}),
			).rejects.toThrow("LLM response refinedAnswer is not a string");
		});

		it("should use temperature 0.3", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ refinedAnswer: "Result" }),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			await refineFieldValue({
				cvRawText: "CV",
				fieldLabel: "Label",
				fieldDescription: "Desc",
				existingAnswer: "Answer",
				userInstructions: "Instruction",
			});

			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.3,
				}),
			);
		});

		it("should calculate token costs correctly", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ refinedAnswer: "Result" }),
				usage: {
					inputTokens: 1000000,
					outputTokens: 500000,
					totalTokens: 1500000,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await refineFieldValue({
				cvRawText: "CV",
				fieldLabel: "Label",
				fieldDescription: "Desc",
				existingAnswer: "Answer",
				userInstructions: "Instruction",
			});

			expect(result.usage.inputCost).toBe(10);
			expect(result.usage.outputCost).toBe(15);
			expect(result.usage.totalCost).toBe(25);
		});
	});
});
