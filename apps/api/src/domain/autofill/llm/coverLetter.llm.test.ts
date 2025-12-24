import type { CoverLetterSettings } from "@lazyapply/types";
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
import type { CoverLetterInput } from "./coverLetter.llm.js";
import { generateCoverLetter } from "./coverLetter.llm.js";

const mockedGenerateText = vi.mocked(generateText);

describe("coverLetter.llm", () => {
	const createTestInput = (
		overrides?: Partial<CoverLetterInput>,
	): CoverLetterInput => ({
		cvRawText: `John Doe
Software Engineer
john@example.com

Experience:
- Senior Backend Engineer at TechCorp (2020-2023)
  Built scalable APIs using Node.js and PostgreSQL
- Backend Developer at StartupXYZ (2018-2020)
  Developed microservices architecture`,
		jdRawText: `We are looking for a Backend Engineer to join our team.
Requirements:
- 3+ years of experience with Node.js
- Experience with PostgreSQL and API design
- Strong problem-solving skills`,
		formContext: "Apply to TechCompany - Backend Engineer Position",
		settings: {
			length: "medium",
			format: "paragraph",
		},
		instructions: "",
		...overrides,
	});

	describe("generateCoverLetter", () => {
		it("should generate a cover letter with medium length and paragraph format", async () => {
			const mockCoverLetter = `I've been working on backend systems for the past five years, mostly with Node.js and PostgreSQL.

At TechCorp, a lot of my time went into building scalable APIs and optimizing database queries. Before that, I helped build a microservices architecture at StartupXYZ.

The role at TechCompany seems like a good fit for the kind of work I've been doing.`;

			mockedGenerateText.mockResolvedValueOnce({
				text: mockCoverLetter,
				usage: {
					inputTokens: 500,
					outputTokens: 150,
					totalTokens: 650,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput();
			const result = await generateCoverLetter(input);

			expect(result.coverLetter).toBe(mockCoverLetter);
			expect(result.usage.promptTokens).toBe(500);
			expect(result.usage.completionTokens).toBe(150);
			expect(result.usage.totalTokens).toBe(650);
			expect(result.usage.inputCost).toBe(0.005);
			expect(result.usage.outputCost).toBe(0.0045);
			expect(result.usage.totalCost).toBe(0.0095);
		});

		it("should generate a short cover letter when length is short", async () => {
			const mockCoverLetter = `I've been working with Node.js and PostgreSQL for five years, building APIs and microservices. The backend role at TechCompany matches the kind of work I've been doing.`;

			mockedGenerateText.mockResolvedValueOnce({
				text: mockCoverLetter,
				usage: {
					inputTokens: 450,
					outputTokens: 80,
					totalTokens: 530,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput({
				settings: {
					length: "short",
					format: "paragraph",
				},
			});
			const result = await generateCoverLetter(input);

			expect(result.coverLetter).toBe(mockCoverLetter);
			expect(result.usage.completionTokens).toBe(80);
		});

		it("should generate a detailed cover letter when length is detailed", async () => {
			const mockCoverLetter = `I've spent the past five years working on backend systems, primarily with Node.js and PostgreSQL. Most of my recent work has been at TechCorp, where I focused on building scalable APIs and optimizing database performance.

Before TechCorp, I was at StartupXYZ where I helped build a microservices architecture from the ground up. It often involved making trade-offs between consistency and availability, and dealing with distributed system challenges.

A lot of my time went into API design and database optimization. I've worked extensively with PostgreSQL, including query optimization, indexing strategies, and connection pooling.

The backend engineer role at TechCompany seems like a natural fit for the kind of work I've been doing. The focus on API design and database work aligns well with my recent experience.`;

			mockedGenerateText.mockResolvedValueOnce({
				text: mockCoverLetter,
				usage: {
					inputTokens: 550,
					outputTokens: 250,
					totalTokens: 800,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput({
				settings: {
					length: "detailed",
					format: "paragraph",
				},
			});
			const result = await generateCoverLetter(input);

			expect(result.coverLetter).toBe(mockCoverLetter);
			expect(result.usage.completionTokens).toBe(250);
		});

		it("should generate a bullet format cover letter", async () => {
			const mockCoverLetter = `I've been working on backend systems for five years:

• Built scalable APIs at TechCorp using Node.js and PostgreSQL
• Developed microservices architecture at StartupXYZ
• Focused on database optimization and API design

The backend role at TechCompany matches my experience with Node.js and PostgreSQL.`;

			mockedGenerateText.mockResolvedValueOnce({
				text: mockCoverLetter,
				usage: {
					inputTokens: 480,
					outputTokens: 120,
					totalTokens: 600,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput({
				settings: {
					length: "medium",
					format: "bullet",
				},
			});
			const result = await generateCoverLetter(input);

			expect(result.coverLetter).toBe(mockCoverLetter);
		});

		it("should include custom instructions in the prompt", async () => {
			const mockCoverLetter = `I've been leading backend teams for the past three years at TechCorp, where I managed a team of five engineers while building scalable APIs.

The technical leadership aspects of the role at TechCompany align with my recent experience.`;

			mockedGenerateText.mockResolvedValueOnce({
				text: mockCoverLetter,
				usage: {
					inputTokens: 520,
					outputTokens: 100,
					totalTokens: 620,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput({
				instructions: "Emphasize leadership experience",
			});
			const result = await generateCoverLetter(input);

			expect(result.coverLetter).toBe(mockCoverLetter);
		});

		it("should handle empty JD text", async () => {
			const mockCoverLetter = `I've been working on backend systems for five years, building APIs and microservices with Node.js and PostgreSQL.

Most of my recent work has been at TechCorp, where I focused on scalable API design and database optimization.`;

			mockedGenerateText.mockResolvedValueOnce({
				text: mockCoverLetter,
				usage: {
					inputTokens: 400,
					outputTokens: 110,
					totalTokens: 510,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput({
				jdRawText: "",
			});
			const result = await generateCoverLetter(input);

			expect(result.coverLetter).toBe(mockCoverLetter);
		});

		it("should handle empty form context", async () => {
			const mockCoverLetter = `I've been working with Node.js and PostgreSQL for five years, building backend systems and APIs.

The role seems like a good match for my experience with API design and database work.`;

			mockedGenerateText.mockResolvedValueOnce({
				text: mockCoverLetter,
				usage: {
					inputTokens: 450,
					outputTokens: 95,
					totalTokens: 545,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput({
				formContext: "",
			});
			const result = await generateCoverLetter(input);

			expect(result.coverLetter).toBe(mockCoverLetter);
		});

		it("should trim whitespace from generated cover letter", async () => {
			const mockCoverLetter = `   
I've been working on backend systems for five years.

The role matches my experience.
   `;

			mockedGenerateText.mockResolvedValueOnce({
				text: mockCoverLetter,
				usage: {
					inputTokens: 400,
					outputTokens: 80,
					totalTokens: 480,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput();
			const result = await generateCoverLetter(input);

			expect(result.coverLetter).toBe(mockCoverLetter.trim());
			expect(result.coverLetter).not.toMatch(/^\s+/);
			expect(result.coverLetter).not.toMatch(/\s+$/);
		});

		it("should calculate token costs correctly", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: "Cover letter text",
				usage: {
					inputTokens: 1000,
					outputTokens: 200,
					totalTokens: 1200,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput();
			const result = await generateCoverLetter(input);

			expect(result.usage.inputCost).toBe(0.01);
			expect(result.usage.outputCost).toBe(0.006);
			expect(result.usage.totalCost).toBe(0.016);
		});

		it("should handle all length options", async () => {
			const lengths: Array<CoverLetterSettings["length"]> = [
				"short",
				"medium",
				"detailed",
			];

			for (const length of lengths) {
				mockedGenerateText.mockResolvedValueOnce({
					text: `Cover letter for ${length}`,
					usage: {
						inputTokens: 400,
						outputTokens: 100,
						totalTokens: 500,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never);

				const input = createTestInput({
					settings: {
						length,
						format: "paragraph",
					},
				});
				const result = await generateCoverLetter(input);

				expect(result.coverLetter).toBe(`Cover letter for ${length}`);
			}
		});

		it("should handle all format options", async () => {
			const formats: Array<CoverLetterSettings["format"]> = [
				"paragraph",
				"bullet",
			];

			for (const format of formats) {
				mockedGenerateText.mockResolvedValueOnce({
					text: `Cover letter in ${format} format`,
					usage: {
						inputTokens: 400,
						outputTokens: 100,
						totalTokens: 500,
					},
				} as ReturnType<typeof generateText> extends Promise<infer T>
					? T
					: never);

				const input = createTestInput({
					settings: {
						length: "medium",
						format,
					},
				});
				const result = await generateCoverLetter(input);

				expect(result.coverLetter).toBe(`Cover letter in ${format} format`);
			}
		});

		it("should use temperature 0.3 for consistent output", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: "Cover letter",
				usage: {
					inputTokens: 400,
					outputTokens: 100,
					totalTokens: 500,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput();
			await generateCoverLetter(input);

			expect(mockedGenerateText).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.3,
				}),
			);
		});

		it("should handle missing optional token usage fields", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: "Cover letter",
				usage: {
					inputTokens: undefined,
					outputTokens: undefined,
					totalTokens: undefined,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const input = createTestInput();
			const result = await generateCoverLetter(input);

			expect(result.usage.promptTokens).toBe(0);
			expect(result.usage.completionTokens).toBe(0);
			expect(result.usage.totalTokens).toBe(0);
			expect(result.usage.inputCost).toBe(0);
			expect(result.usage.outputCost).toBe(0);
			expect(result.usage.totalCost).toBe(0);
		});
	});
});
