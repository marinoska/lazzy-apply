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
import { validateJdFormMatchWithAI } from "./jdMatcher.llm.js";

const mockedGenerateText = vi.mocked(generateText);

describe("jdMatcher.llm", () => {
	describe("validateJdFormMatchWithAI", () => {
		it("should return isMatch: false for empty JD text", async () => {
			const result = await validateJdFormMatchWithAI({
				jdText: "",
				formFields: [
					{
						hash: "field-1",
						field: {
							tag: "input",
							type: "text",
							name: "email",
							label: "Email",
							placeholder: null,
							description: null,
							isFileUpload: false,
							accept: null,
						},
					},
				],
				jdUrl: "https://example.com/job",
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(false);
			expect(result.usage.totalTokens).toBe(0);
			expect(mockedGenerateText).not.toHaveBeenCalled();
		});

		it("should return isMatch: false for whitespace-only JD text", async () => {
			const result = await validateJdFormMatchWithAI({
				jdText: "   \n\t  ",
				formFields: [],
				jdUrl: null,
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(false);
			expect(result.usage.totalTokens).toBe(0);
			expect(mockedGenerateText).not.toHaveBeenCalled();
		});

		it("should call LLM and return true when JD matches form", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ isMatch: true }),
				usage: {
					inputTokens: 500,
					outputTokens: 10,
					totalTokens: 510,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await validateJdFormMatchWithAI({
				jdText:
					"Senior Software Engineer at Acme Corp. Requirements: 5+ years experience...",
				formFields: [
					{
						hash: "field-1",
						field: {
							tag: "input",
							type: "text",
							name: "experience",
							label: "Years of experience",
							placeholder: null,
							description: null,
							isFileUpload: false,
							accept: null,
						},
					},
				],
				jdUrl: "https://acme.com/jobs/senior-engineer",
				formUrl: "https://acme.com/apply/senior-engineer",
			});

			expect(result.isMatch).toBe(true);
			expect(result.usage.totalTokens).toBe(510);
			expect(mockedGenerateText).toHaveBeenCalledTimes(1);
		});

		it("should call LLM and return false when JD does not match form", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ isMatch: false }),
				usage: {
					inputTokens: 400,
					outputTokens: 10,
					totalTokens: 410,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await validateJdFormMatchWithAI({
				jdText: "Marketing Manager position at XYZ Inc.",
				formFields: [
					{
						hash: "field-1",
						field: {
							tag: "input",
							type: "text",
							name: "coding_experience",
							label: "Programming languages",
							placeholder: null,
							description: null,
							isFileUpload: false,
							accept: null,
						},
					},
				],
				jdUrl: "https://xyz.com/jobs/marketing",
				formUrl: "https://different-ats.com/apply/123",
			});

			expect(result.isMatch).toBe(false);
			expect(result.usage.totalTokens).toBe(410);
		});

		it("should handle markdown code blocks in response", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: `\`\`\`json
{
  "isMatch": true
}
\`\`\``,
				usage: {
					inputTokens: 500,
					outputTokens: 10,
					totalTokens: 510,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await validateJdFormMatchWithAI({
				jdText: "Some job description",
				formFields: [],
				jdUrl: "https://example.com/job",
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(true);
		});

		it("should return false for invalid response format", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ invalid: "format" }),
				usage: {
					inputTokens: 100,
					outputTokens: 10,
					totalTokens: 110,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await validateJdFormMatchWithAI({
				jdText: "Some job description",
				formFields: [],
				jdUrl: null,
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(false);
		});

		it("should include form field metadata in the prompt", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ isMatch: true }),
				usage: {
					inputTokens: 500,
					outputTokens: 10,
					totalTokens: 510,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			await validateJdFormMatchWithAI({
				jdText: "Job description text",
				formFields: [
					{
						hash: "field-1",
						field: {
							tag: "input",
							type: "text",
							name: "years_experience",
							label: "Years of Experience",
							placeholder: "Enter years",
							description: "How many years have you worked?",
							isFileUpload: false,
							accept: null,
						},
					},
				],
				jdUrl: "https://example.com/job",
				formUrl: "https://example.com/apply",
			});

			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("Years of Experience"),
				}),
			);
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("Enter years"),
				}),
			);
		});

		it("should include URLs in the prompt", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ isMatch: false }),
				usage: {
					inputTokens: 300,
					outputTokens: 10,
					totalTokens: 310,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			await validateJdFormMatchWithAI({
				jdText: "Job description",
				formFields: [],
				jdUrl: "https://company.com/careers/job-123",
				formUrl: "https://ats.com/apply/456",
			});

			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining(
						"https://company.com/careers/job-123",
					),
				}),
			);
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining("https://ats.com/apply/456"),
				}),
			);
		});

		it("should handle null jdUrl", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ isMatch: false }),
				usage: {
					inputTokens: 300,
					outputTokens: 10,
					totalTokens: 310,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await validateJdFormMatchWithAI({
				jdText: "Job description",
				formFields: [],
				jdUrl: null,
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(false);
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining('"jdURL": null'),
				}),
			);
		});

		it("should calculate token costs correctly", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({ isMatch: true }),
				usage: {
					inputTokens: 1000,
					outputTokens: 100,
					totalTokens: 1100,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await validateJdFormMatchWithAI({
				jdText: "Job description",
				formFields: [],
				jdUrl: "https://example.com/job",
				formUrl: "https://example.com/apply",
			});

			// inputCost = (1000 / 1_000_000) * 10 = 0.01
			// outputCost = (100 / 1_000_000) * 30 = 0.003
			expect(result.usage.inputCost).toBeCloseTo(0.01);
			expect(result.usage.outputCost).toBeCloseTo(0.003);
			expect(result.usage.totalCost).toBeCloseTo(0.013);
		});
	});
});
