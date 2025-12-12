import type { Field } from "@lazyapply/types";
import { describe, expect, it, vi } from "vitest";

// We need to test the parseClassificationResponse function
// Since it's not exported, we'll test through the module internals

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
import { classifyFieldsWithAI } from "./classifier.service.js";

const mockedGenerateText = vi.mocked(generateText);

describe("classifier.service", () => {
	const createTestField = (
		hash: string,
		label: string,
		type = "text",
	): Field => ({
		hash,
		field: {
			tag: "input",
			type,
			name: label.toLowerCase().replace(/\s+/g, "_"),
			label,
			placeholder: null,
			description: null,
			isFileUpload: false,
			accept: null,
		},
	});

	describe("classifyFieldsWithAI", () => {
		it("should classify a field with a valid path", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify([{ hash: "email-hash", path: "personal.email" }]),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const fields = [createTestField("email-hash", "Email")];
			const result = await classifyFieldsWithAI(fields);

			expect(result.classifiedFields).toHaveLength(1);
			expect(result.classifiedFields[0].classification).toBe("personal.email");
			expect(result.classifiedFields[0].inferenceHint).toBeUndefined();
		});

		it("should set inferenceHint for unknown fields that can be inferred from JD + CV", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify([
					{
						hash: "motivation-hash",
						path: "unknown",
						inferenceHint: "text_from_jd_cv",
					},
				]),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const fields = [
				createTestField("motivation-hash", "Why do you want this role?"),
			];
			const result = await classifyFieldsWithAI(fields);

			expect(result.classifiedFields).toHaveLength(1);
			expect(result.classifiedFields[0].classification).toBe("unknown");
			expect(result.classifiedFields[0].inferenceHint).toBe("text_from_jd_cv");
		});

		it("should NOT set inferenceHint for unknown fields without the hint", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify([
					{ hash: "consent-hash", path: "unknown" }, // No inferenceHint
				]),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const fields = [
				createTestField("consent-hash", "I agree to terms", "checkbox"),
			];
			const result = await classifyFieldsWithAI(fields);

			expect(result.classifiedFields).toHaveLength(1);
			expect(result.classifiedFields[0].classification).toBe("unknown");
			expect(result.classifiedFields[0].inferenceHint).toBeUndefined();
		});

		it("should ignore inferenceHint when classification is not unknown", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify([
					{
						hash: "email-hash",
						path: "personal.email",
						inferenceHint: "text_from_jd_cv", // Should be ignored
					},
				]),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const fields = [createTestField("email-hash", "Email")];
			const result = await classifyFieldsWithAI(fields);

			expect(result.classifiedFields).toHaveLength(1);
			expect(result.classifiedFields[0].classification).toBe("personal.email");
			expect(result.classifiedFields[0].inferenceHint).toBeUndefined();
		});

		it("should ignore invalid inferenceHint values", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify([
					{
						hash: "motivation-hash",
						path: "unknown",
						inferenceHint: "invalid_hint", // Invalid value
					},
				]),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const fields = [
				createTestField("motivation-hash", "Why do you want this role?"),
			];
			const result = await classifyFieldsWithAI(fields);

			expect(result.classifiedFields).toHaveLength(1);
			expect(result.classifiedFields[0].classification).toBe("unknown");
			expect(result.classifiedFields[0].inferenceHint).toBeUndefined();
		});

		it("should handle linkType for links path", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify([
					{ hash: "linkedin-hash", path: "links", linkType: "linkedin" },
				]),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const fields = [createTestField("linkedin-hash", "LinkedIn URL", "url")];
			const result = await classifyFieldsWithAI(fields);

			expect(result.classifiedFields).toHaveLength(1);
			expect(result.classifiedFields[0].classification).toBe("links");
			expect(result.classifiedFields[0].linkType).toBe("linkedin");
			expect(result.classifiedFields[0].inferenceHint).toBeUndefined();
		});

		it("should handle markdown code blocks in response", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: `\`\`\`json
[{"hash": "email-hash", "path": "personal.email"}]
\`\`\``,
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const fields = [createTestField("email-hash", "Email")];
			const result = await classifyFieldsWithAI(fields);

			expect(result.classifiedFields).toHaveLength(1);
			expect(result.classifiedFields[0].classification).toBe("personal.email");
		});

		it("should fallback to unknown for invalid paths", async () => {
			mockedGenerateText.mockResolvedValueOnce({
				text: JSON.stringify([
					{ hash: "field-hash", path: "invalid.path.that.does.not.exist" },
				]),
				usage: {
					inputTokens: 100,
					outputTokens: 50,
					totalTokens: 150,
				},
			} as ReturnType<typeof generateText> extends Promise<infer T>
				? T
				: never);

			const fields = [createTestField("field-hash", "Some field")];
			const result = await classifyFieldsWithAI(fields);

			expect(result.classifiedFields).toHaveLength(1);
			expect(result.classifiedFields[0].classification).toBe("unknown");
		});
	});
});
