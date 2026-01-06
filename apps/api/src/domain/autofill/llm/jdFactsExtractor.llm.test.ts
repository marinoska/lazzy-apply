import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { extractJdFormFactsWithAI } from "./JdFactsExtractor.llm.js";

const mockedGenerateText = vi.mocked(generateText);

describe("jdMatcher.llm", () => {
	describe("validateJdFormMatchWithAI", () => {
		beforeEach(() => {
			vi.clearAllMocks();
		});

		it("should return isMatch: false for empty JD text", async () => {
			const result = await extractJdFormFactsWithAI({
				jdRawText: "",
				formContext: "",
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
			expect(result.jdFacts).toEqual([]);
			expect(result.routerUsage).toBeNull();
			expect(result.writerUsage).toBeNull();
			expect(mockedGenerateText).not.toHaveBeenCalled();
		});

		it("should return isMatch: false for whitespace-only JD text", async () => {
			const result = await extractJdFormFactsWithAI({
				jdRawText: "   \n\t  ",
				formContext: "",
				formFields: [],
				jdUrl: null,
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(false);
			expect(result.jdFacts).toEqual([]);
			expect(result.routerUsage).toBeNull();
			expect(result.writerUsage).toBeNull();
			expect(mockedGenerateText).not.toHaveBeenCalled();
		});

		it("should call LLM and return true when JD matches form", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({
					isMatch: true,
					jdFacts: {
						facts: [
							{ key: "role", value: "Senior Software Engineer", source: "jd" },
							{ key: "company", value: "Acme Corp", source: "jd" },
							{ key: "experience", value: "5+ years", source: "jd" },
						],
					},
				}),
				usage: {
					inputTokens: 500,
					outputTokens: 10,
					totalTokens: 510,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await extractJdFormFactsWithAI({
				jdRawText:
					"Senior Software Engineer at Acme Corp. Requirements: 5+ years experience...",
				formContext: "",
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
			expect(result.jdFacts).toEqual([
				{ key: "role", value: "Senior Software Engineer", source: "jd" },
				{ key: "company", value: "Acme Corp", source: "jd" },
				{ key: "experience", value: "5+ years", source: "jd" },
			]);
			expect(result.routerUsage).not.toBeNull();
			expect(result.routerUsage?.totalTokens).toBe(510);
			expect(result.writerUsage).toBeNull();
			expect(mockedGenerateText).toHaveBeenCalledTimes(1);
		});

		it("should call LLM and return false when JD does not match form", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({
					isMatch: false,
					jdFacts: {
						facts: [
							{ key: "role", value: "Marketing Manager", source: "form" },
						],
					},
				}),
				usage: {
					inputTokens: 400,
					outputTokens: 10,
					totalTokens: 410,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await extractJdFormFactsWithAI({
				jdRawText: "Marketing Manager position at XYZ Inc.",
				formContext: "",
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
			expect(result.jdFacts).toEqual([
				{ key: "role", value: "Marketing Manager", source: "form" },
			]);
			expect(result.routerUsage).not.toBeNull();
			expect(result.routerUsage?.totalTokens).toBe(410);
			expect(result.writerUsage).toBeNull();
		});

		it("should handle markdown code blocks in response", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: `\`\`\`json
{
  "isMatch": true,
  "jdFacts": {
    "facts": [
      { "key": "role", "value": "Software Developer", "source": "jd" }
    ]
  }
}
\`\`\``,
				usage: {
					inputTokens: 1000,
					outputTokens: 100,
					totalTokens: 1100,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await extractJdFormFactsWithAI({
				jdRawText: "Some job description",
				formContext: "",
				formFields: [],
				jdUrl: "https://example.com/job",
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(true);
			expect(result.jdFacts).toEqual([
				{ key: "role", value: "Software Developer", source: "jd" },
			]);
			expect(result.routerUsage).not.toBeNull();
			expect(result.routerUsage?.inputCost).toBeCloseTo(0.01);
			expect(result.routerUsage?.outputCost).toBeCloseTo(0.003);
			expect(result.routerUsage?.totalCost).toBeCloseTo(0.013);
			expect(result.writerUsage).toBeNull();
		});

		it("should use extraction-only prompt when URLs match (optimization)", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({
					isMatch: true,
					jdFacts: {
						facts: [
							{ key: "role", value: "Backend Engineer", source: "jd" },
							{ key: "location", value: "Remote", source: "jd" },
						],
					},
				}),
				usage: {
					inputTokens: 200,
					outputTokens: 50,
					totalTokens: 250,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await extractJdFormFactsWithAI({
				jdRawText: "Backend Engineer position. Location: Remote.",
				formContext: "Some form context that should be ignored",
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
				jdUrl: "https://example.com/apply",
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(true);
			expect(result.jdFacts).toEqual([
				{ key: "role", value: "Backend Engineer", source: "jd" },
				{ key: "location", value: "Remote", source: "jd" },
			]);
			expect(result.routerUsage).toBeNull();
			expect(result.writerUsage).not.toBeNull();
			expect(result.writerUsage?.totalTokens).toBe(250);
		});

		it("should set formContext to (empty) when URLs match and jdRawText is provided", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({
					isMatch: true,
					jdFacts: {
						facts: [{ key: "role", value: "Software Developer", source: "jd" }],
					},
				}),
				usage: {
					inputTokens: 150,
					outputTokens: 40,
					totalTokens: 190,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await extractJdFormFactsWithAI({
				jdRawText: "Software Developer position",
				formContext: "Additional context from form page",
				formFields: [],
				jdUrl: "https://example.com/apply",
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(true);
			expect(result.jdFacts).toEqual([
				{ key: "role", value: "Software Developer", source: "jd" },
			]);
			expect(result.routerUsage).toBeNull();
			expect(result.writerUsage).not.toBeNull();
			expect(result.writerUsage?.totalTokens).toBe(190);
		});

		it("should use formContext as fallback when URLs match and jdRawText is empty", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({
					isMatch: true,
					jdFacts: {
						facts: [
							{ key: "role", value: "Software Developer", source: "form" },
							{ key: "company", value: "Tech Corp", source: "form" },
						],
					},
				}),
				usage: {
					inputTokens: 150,
					outputTokens: 40,
					totalTokens: 190,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await extractJdFormFactsWithAI({
				jdRawText: "",
				formContext: "Software Developer at Tech Corp. Apply now!",
				formFields: [
					{
						hash: "field-1",
						field: {
							tag: "input",
							type: "text",
							name: "name",
							label: "Full Name",
							placeholder: null,
							description: null,
							isFileUpload: false,
							accept: null,
						},
					},
				],
				jdUrl: "https://example.com/apply",
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(true);
			expect(result.jdFacts).toEqual([
				{ key: "role", value: "Software Developer", source: "form" },
				{ key: "company", value: "Tech Corp", source: "form" },
			]);
			expect(result.routerUsage).toBeNull();
			expect(result.writerUsage).not.toBeNull();
			expect(result.writerUsage?.totalTokens).toBe(190);
		});

		it("should return early when both jdRawText and formContext are empty even if URLs match", async () => {
			const result = await extractJdFormFactsWithAI({
				jdRawText: "",
				formContext: "",
				formFields: [],
				jdUrl: "https://example.com/apply",
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(true);
			expect(result.jdFacts).toEqual([]);
			expect(result.routerUsage).toBeNull();
			expect(result.writerUsage).toBeNull();
			expect(mockedGenerateText).not.toHaveBeenCalled();
		});

		it("should use formContext when URLs match and jdRawText is whitespace-only", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify({
					isMatch: true,
					jdFacts: {
						facts: [
							{ key: "role", value: "Frontend Developer", source: "form" },
						],
					},
				}),
				usage: {
					inputTokens: 120,
					outputTokens: 30,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const result = await extractJdFormFactsWithAI({
				jdRawText: "   ",
				formContext: "Frontend Developer position available",
				formFields: [],
				jdUrl: "https://example.com/apply",
				formUrl: "https://example.com/apply",
			});

			expect(result.isMatch).toBe(true);
			expect(result.jdFacts).toEqual([
				{ key: "role", value: "Frontend Developer", source: "form" },
			]);
			expect(result.routerUsage).toBeNull();
			expect(result.writerUsage).not.toBeNull();
			expect(result.writerUsage?.totalTokens).toBe(150);

			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining(
						"Frontend Developer position available",
					),
				}),
			);
			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					prompt: expect.stringContaining('"jd": "(empty)"'),
				}),
			);
		});
	});
});
