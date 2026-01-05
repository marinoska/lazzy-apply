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
			mockedGenerateText
				.mockResolvedValueOnce({
					text: JSON.stringify({
						useProfileSignals: false,
						useSummaryFacts: true,
						useExperienceFacts: false,
						useJdFacts: false,
						reason: "Need summary facts for name",
					}),
					usage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never)
				.mockResolvedValueOnce({
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
				fieldLabel: "Full Name",
				fieldDescription: "Please enter your full name",
				existingAnswer: "John Doe",
				userInstructions: "Use my middle name",
				profileSignals: {},
				summaryFacts: ["Name: John Michael Doe"],
				experienceFacts: [],
				jdFacts: [],
			});

			expect(result.refinedAnswer).toBe("John Michael Doe");
			expect(result.usage.totalTokens).toBe(750);
			expect(result.usage.inputCost).toBeDefined();
			expect(result.usage.outputCost).toBeDefined();
			expect(result.usage.totalCost).toBeDefined();
			expect(result.routingDecision).toEqual({
				useProfileSignals: false,
				useSummaryFacts: true,
				useExperienceFacts: false,
				useJdFacts: false,
				reason: "Need summary facts for name",
			});
			expect(mockedGenerateText).toHaveBeenCalledTimes(2);
		});

		it("should handle markdown code blocks in response", async () => {
			mockedGenerateText
				.mockResolvedValueOnce({
					text: JSON.stringify({
						useProfileSignals: false,
						useSummaryFacts: false,
						useExperienceFacts: false,
						useJdFacts: false,
						reason: "Just shortening, no context needed",
					}),
					usage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never)
				.mockResolvedValueOnce({
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
				fieldLabel: "Experience",
				fieldDescription: "Describe your experience",
				existingAnswer: "Original text",
				userInstructions: "Make it shorter",
				profileSignals: {},
				summaryFacts: [],
				experienceFacts: [],
				jdFacts: [],
			});

			expect(result.refinedAnswer).toBe("Refined text here");
		});

		it("should include all input fields in the prompt", async () => {
			mockedGenerateText
				.mockResolvedValueOnce({
					text: JSON.stringify({
						useProfileSignals: false,
						useSummaryFacts: true,
						useExperienceFacts: true,
						useJdFacts: true,
						reason: "Need all context for motivation",
					}),
					usage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never)
				.mockResolvedValueOnce({
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
				fieldLabel: "Why this role?",
				fieldDescription: "Explain your motivation",
				existingAnswer: "I like coding",
				userInstructions: "Be more specific",
				profileSignals: { seniority: "mid" },
				summaryFacts: ["Software engineer"],
				experienceFacts: [
					{ role: "Engineer", company: "Tech Co", facts: ["Built APIs"] },
				],
				jdFacts: [{ key: "role", value: "Backend Engineer", source: "jd" }],
			});

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
			mockedGenerateText
				.mockResolvedValueOnce({
					text: JSON.stringify({
						useProfileSignals: false,
						useSummaryFacts: true,
						useExperienceFacts: false,
						useJdFacts: false,
						reason: "Need summary for name",
					}),
					usage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never)
				.mockResolvedValueOnce({
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
				fieldLabel: "Name",
				fieldDescription: "",
				existingAnswer: "John",
				userInstructions: "Add surname",
				profileSignals: {},
				summaryFacts: ["Name: John Doe"],
				experienceFacts: [],
				jdFacts: [],
			});

			expect(result.refinedAnswer).toBe("Result");
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("(none)"),
				}),
			);
		});

		it("should throw error for invalid response format", async () => {
			mockedGenerateText
				.mockResolvedValueOnce({
					text: JSON.stringify({
						useProfileSignals: false,
						useSummaryFacts: false,
						useExperienceFacts: false,
						useJdFacts: false,
						reason: "No context needed",
					}),
					usage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never)
				.mockResolvedValueOnce({
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
					fieldLabel: "Label",
					fieldDescription: "Description",
					existingAnswer: "Answer",
					userInstructions: "Instructions",
					profileSignals: {},
					summaryFacts: [],
					experienceFacts: [],
					jdFacts: [],
				}),
			).rejects.toThrow("LLM response does not contain refinedAnswer field");
		});

		it("should throw error when refinedAnswer is not a string", async () => {
			mockedGenerateText
				.mockResolvedValueOnce({
					text: JSON.stringify({
						useProfileSignals: false,
						useSummaryFacts: false,
						useExperienceFacts: false,
						useJdFacts: false,
						reason: "No context needed",
					}),
					usage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never)
				.mockResolvedValueOnce({
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
					fieldLabel: "Label",
					fieldDescription: "Description",
					existingAnswer: "Answer",
					userInstructions: "Instructions",
					profileSignals: {},
					summaryFacts: [],
					experienceFacts: [],
					jdFacts: [],
				}),
			).rejects.toThrow("LLM response refinedAnswer is not a string");
		});

		it("should use temperature 0.1 for router and 0.3 for writer", async () => {
			mockedGenerateText
				.mockResolvedValueOnce({
					text: JSON.stringify({
						useProfileSignals: false,
						useSummaryFacts: false,
						useExperienceFacts: false,
						useJdFacts: false,
						reason: "No context needed",
					}),
					usage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never)
				.mockResolvedValueOnce({
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
				fieldLabel: "Label",
				fieldDescription: "Desc",
				existingAnswer: "Answer",
				userInstructions: "Instruction",
				profileSignals: {},
				summaryFacts: [],
				experienceFacts: [],
				jdFacts: [],
			});

			expect(mockedGenerateText).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					temperature: 0.1,
				}),
			);
			expect(mockedGenerateText).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					temperature: 0.3,
				}),
			);
		});

		it("should calculate token costs correctly", async () => {
			mockedGenerateText
				.mockResolvedValueOnce({
					text: JSON.stringify({
						useProfileSignals: false,
						useSummaryFacts: false,
						useExperienceFacts: false,
						useJdFacts: false,
						reason: "No context needed",
					}),
					usage: {
						inputTokens: 500000,
						outputTokens: 250000,
						totalTokens: 750000,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never)
				.mockResolvedValueOnce({
					text: JSON.stringify({ refinedAnswer: "Result" }),
					usage: {
						inputTokens: 500000,
						outputTokens: 250000,
						totalTokens: 750000,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never);

			const result = await refineFieldValue({
				fieldLabel: "Label",
				fieldDescription: "Desc",
				existingAnswer: "Answer",
				userInstructions: "Instruction",
				profileSignals: {},
				summaryFacts: [],
				experienceFacts: [],
				jdFacts: [],
			});

			expect(result.usage.totalTokens).toBe(1500000);
			expect(result.usage.inputCost).toBe(10);
			expect(result.usage.outputCost).toBe(15);
			expect(result.usage.totalCost).toBe(25);
		});
	});
});
