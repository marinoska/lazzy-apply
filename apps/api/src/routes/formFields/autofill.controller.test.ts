import type { Field } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CVDataModel } from "@/cvData/index.js";
import { FormModel } from "@/formFields/form.model.js";
import { FormFieldModel } from "@/formFields/formField.model.js";
import { autofill } from "./autofill.controller.js";
import type { EnrichedClassifiedField } from "./services/classifier.service.js";

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
	classifyFieldsWithAI: vi.fn().mockImplementation((fields: Field[]) => {
		const classifiedFields: EnrichedClassifiedField[] = fields.map((f) => ({
			...f,
			classification: "personal.email" as const,
		}));
		return Promise.resolve({
			classifiedFields,
			usage: {
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
				inputCost: 0.0001,
				outputCost: 0.00005,
				totalCost: 0.00015,
			},
		});
	}),
}));

const TEST_UPLOAD_ID = "507f1f77bcf86cd799439011";

describe("autofill.controller", () => {
	let mockReq: {
		user: { id: string };
		body: {
			form: {
				formHash: string;
				fields: Array<{ hash: string }>;
				pageUrl: string;
				action: string | null;
			};
			fields: Array<{
				hash: string;
				field: {
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
			selectedUploadId: string;
		};
	};
	let mockRes: {
		json: ReturnType<typeof vi.fn>;
	};

	beforeEach(async () => {
		await FormModel.deleteMany({});
		await FormFieldModel.deleteMany({});
		await CVDataModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});

		// Create test CV data
		await CVDataModel.createCVData({
			uploadId: TEST_UPLOAD_ID,
			userId: "test-user-id",
			personal: {
				fullName: "Test User",
				email: "test@example.com",
				phone: null,
				location: null,
			},
			links: [],
			headline: null,
			summary: null,
			experience: [],
			education: [],
			certifications: [],
			languages: [],
			extras: {},
			rawText: "Test CV",
		});

		vi.clearAllMocks();

		mockRes = {
			json: vi.fn(),
		};

		mockReq = {
			user: { id: "test-user-id" },
			body: {
				form: {
					formHash: "test-form-hash",
					fields: [{ hash: "hash-1" }],
					pageUrl: "https://example.com/apply",
					action: "https://example.com/submit",
				},
				fields: [
					{
						hash: "hash-1",
						field: {
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
				selectedUploadId: TEST_UPLOAD_ID,
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
						classification: "personal.email",
					},
				],
				pageUrls: ["https://example.com/apply"],
				actions: ["https://example.com/submit"],
			});

			await autofill(mockReq as never, mockRes as never);

			expect(mockRes.json).toHaveBeenCalledWith({
				"hash-1": {
					fieldName: "email",
					path: "personal.email",
					pathFound: true,
					value: "test@example.com",
				},
			});
		});

		it("should classify and return response when form does not exist", async () => {
			await autofill(mockReq as never, mockRes as never);

			expect(mockRes.json).toHaveBeenCalled();
			const response = mockRes.json.mock.calls[0][0];
			expect(typeof response).toBe("object");
			expect(Object.keys(response).length).toBeGreaterThanOrEqual(1);
		});

		it("should persist form after classification", async () => {
			await autofill(mockReq as never, mockRes as never);

			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();
			expect(savedForm?.pageUrls).toContain("https://example.com/apply");
		});
	});
});
