import { describe, it, expect, beforeEach, vi } from "vitest";
import { FormFieldModel } from "@/formFields/formField.model.js";
import { FormModel } from "@/formFields/form.model.js";
import { autofill } from "./autofill.controller.js";

// Mock env to have OPENAI_API_KEY and LOG_LEVEL
vi.mock("@/app/env.js", () => ({
	env: {
		OPENAI_API_KEY: "test-key",
		OPENAI_MODEL: "gpt-4",
		OPENAI_MODEL_INPUT_PRICE_PER_1M: 0.01,
		OPENAI_MODEL_OUTPUT_PRICE_PER_1M: 0.03,
		LOG_LEVEL: "silent",
		NODE_ENV: "test",
	},
}));

// Mock the classifier service to avoid actual AI calls
vi.mock("./services/classifier.service.js", () => ({
	classifyFieldsWithAI: vi.fn().mockResolvedValue({
		classifications: [
			{ hash: "hash-1", classification: "personal.email" },
		],
		usage: {
			promptTokens: 100,
			completionTokens: 50,
			totalTokens: 150,
		},
	}),
}));

describe("autofill.controller", () => {
	let mockReq: {
		body: {
			form: {
				formHash: string;
				fields: Array<{ hash: string; path: string | null }>;
				pageUrl: string;
				action: string | null;
			};
			fields: Array<{
				fieldHash: string;
				field: {
					id: string;
					tag: string;
					type: string;
					name: string | null;
					label: string | null;
					placeholder: string | null;
					description: string | null;
					isFileUpload: boolean;
					accept: string | null;
				};
			}>;
		};
	};
	let mockRes: {
		json: ReturnType<typeof vi.fn>;
	};

	beforeEach(async () => {
		await FormModel.deleteMany({});
		await FormFieldModel.deleteMany({});
		vi.clearAllMocks();

		mockRes = {
			json: vi.fn(),
		};

		mockReq = {
			body: {
				form: {
					formHash: "test-form-hash",
					fields: [
						{ hash: "hash-1", path: null },
					],
					pageUrl: "https://example.com/apply",
					action: "https://example.com/submit",
				},
				fields: [
					{
						fieldHash: "hash-1",
						field: {
							id: "email-field",
							tag: "input",
							type: "email",
							name: "email",
							label: "Email Address",
							placeholder: "Enter your email",
							description: null,
							isFileUpload: false,
							accept: null,
						},
					},
				],
			},
		};
	});

	describe("autofill", () => {
		it("should return cached response when form exists", async () => {
			// Create existing form
			await FormModel.create({
				formHash: "test-form-hash",
				fields: [
					{
						hash: "hash-1",
						path: "personal.email",
					},
				],
				pageUrls: ["https://example.com/apply"],
				actions: ["https://example.com/submit"],
			});

			await autofill(mockReq as never, mockRes as never);

			expect(mockRes.json).toHaveBeenCalledWith([
				{
					fieldId: "email-field",
					fieldName: "email",
					path: "personal.email",
				},
			]);
		});

		it("should classify and return response when form does not exist", async () => {
			await autofill(mockReq as never, mockRes as never);

			expect(mockRes.json).toHaveBeenCalled();
			const response = mockRes.json.mock.calls[0][0];
			expect(Array.isArray(response)).toBe(true);
			expect(response.length).toBeGreaterThanOrEqual(1);
		});

		it("should persist form after classification", async () => {
			await autofill(mockReq as never, mockRes as never);

			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();
			expect(savedForm?.pageUrls).toContain("https://example.com/apply");
		});
	});
});
