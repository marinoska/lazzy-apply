import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateCoverLetterController } from "./coverLetter.controller.js";

vi.mock("@/app/env.js", () => ({
	env: {
		LOG_LEVEL: "silent",
		NODE_ENV: "test",
	},
	getEnv: vi.fn(),
}));

vi.mock("../llm/coverLetter.llm.js", () => ({
	generateCoverLetter: vi.fn(),
}));

vi.mock("../model/autofill.model.js", () => ({
	AutofillModel: {
		findByAutofillId: vi.fn(),
	},
}));

vi.mock("mongoose", async () => {
	const actual = await vi.importActual<typeof import("mongoose")>("mongoose");
	return {
		...actual,
		default: {
			...actual.default,
			startSession: vi.fn(() => ({
				withTransaction: vi.fn(async (fn) => await fn()),
				endSession: vi.fn(),
			})),
		},
	};
});

vi.mock("../model/autofillCoverLetter.model.js", () => ({
	AutofillCoverLetterModel: {
		create: vi.fn(),
	},
	AUTOFILL_COVER_LETTER_MODEL_NAME: "autofill_cover_letters",
}));

vi.mock("@/domain/uploads/model/cvData.model.js", () => ({
	CVDataModel: {
		findById: vi.fn(() => ({
			setOptions: vi.fn(() => ({
				lean: vi.fn(),
			})),
		})),
	},
}));

vi.mock("@/domain/usage/index.js", () => ({
	UsageTracker: vi.fn().mockImplementation(() => ({
		setReference: vi.fn(),
		setAutofillId: vi.fn(),
		setUsage: vi.fn(),
		persistAllUsage: vi.fn(),
	})),
}));

import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { UsageTracker } from "@/domain/usage/index.js";
import { generateCoverLetter } from "../llm/coverLetter.llm.js";
import { AutofillModel } from "../model/autofill.model.js";
import { AutofillCoverLetterModel } from "../model/autofillCoverLetter.model.js";

const mockedGenerateCoverLetter = vi.mocked(generateCoverLetter);
const mockedAutofillModel = vi.mocked(AutofillModel);
const mockedCVDataModel = vi.mocked(CVDataModel);
const mockedAutofillCoverLetterModel = vi.mocked(AutofillCoverLetterModel);
const _mockedUsageTracker = vi.mocked(UsageTracker);

describe("coverLetter.controller", () => {
	let mockReq: {
		user: { id: string };
		query: {
			autofillId: string;
			fieldHash: string;
		};
		body: {
			instructions?: string;
			settings?: {
				length: "short" | "medium" | "detailed";
				format: "paragraph" | "bullet";
			};
		};
	};
	let mockRes: {
		status: ReturnType<typeof vi.fn>;
		json: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		mockRes = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
		};

		mockReq = {
			user: { id: "test-user-id" },
			query: {
				autofillId: "test-autofill-id",
				fieldHash: "test-field-hash",
			},
			body: {
				instructions: "Highlight leadership experience",
				settings: {
					length: "medium",
					format: "paragraph",
				},
			},
		};

		mockedAutofillModel.findByAutofillId.mockResolvedValue({
			userId: "test-user-id",
			uploadReference: "test-upload-id",
			cvDataReference: "test-cv-data-id",
			autofillId: "test-autofill-id",
			formReference: "test-form-id",
			data: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		} as never);

		const mockLean = vi.fn().mockResolvedValue({
			rawText: "John Doe, Software Engineer with 5 years experience",
		});

		const mockSetOptions = vi.fn().mockReturnValue({
			lean: mockLean,
		});

		mockedCVDataModel.findById.mockReturnValue({
			setOptions: mockSetOptions,
		} as never);

		mockedGenerateCoverLetter.mockResolvedValue({
			coverLetter:
				"Dear Hiring Manager,\n\nI am writing to express my interest...",
			usage: {
				promptTokens: 1000,
				completionTokens: 200,
				totalTokens: 1200,
				inputCost: 0.01,
				outputCost: 0.006,
				totalCost: 0.016,
			},
		});

		mockedAutofillCoverLetterModel.create.mockResolvedValue([
			{
				_id: "test-cover-letter-id",
				autofillId: "test-autofill-id",
				hash: "test-field-hash",
				value: "Dear Hiring Manager,\n\nI am writing to express my interest...",
				instructions: "Highlight leadership experience",
				length: "medium",
				format: "paragraph",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		] as never);
	});

	describe("generateCoverLetterController", () => {
		it("should return placeholder cover letter with autofillId", async () => {
			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "test-autofill-id",
				coverLetter: expect.stringContaining("Dear Hiring Manager"),
			});
		});

		it("should throw Unauthorized when user is missing", async () => {
			const reqWithoutUser = {
				...mockReq,
				user: undefined,
			};

			await expect(
				generateCoverLetterController(
					reqWithoutUser as never,
					mockRes as never,
				),
			).rejects.toThrow("Missing authenticated user");
		});

		it("should handle request without instructions", async () => {
			mockReq.body.instructions = undefined;

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "test-autofill-id",
				coverLetter: expect.any(String),
			});
		});

		it("should handle request without settings", async () => {
			mockReq.body.settings = undefined;

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "test-autofill-id",
				coverLetter: expect.any(String),
			});
		});

		it("should accept all valid length options", async () => {
			const lengths = ["short", "medium", "detailed"] as const;

			for (const length of lengths) {
				if (mockReq.body.settings) {
					mockReq.body.settings = {
						...mockReq.body.settings,
						length,
					};
				}

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should accept all valid format options", async () => {
			const formats = ["paragraph", "bullet"] as const;

			for (const format of formats) {
				if (mockReq.body.settings) {
					mockReq.body.settings = {
						...mockReq.body.settings,
						format,
					};
				}

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should handle different autofillIds", async () => {
			const autofillIds = ["autofill-123", "autofill-456", "test-autofill-789"];

			for (const autofillId of autofillIds) {
				mockReq.query.autofillId = autofillId;

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.json).toHaveBeenCalledWith(
					expect.objectContaining({
						autofillId,
					}),
				);
			}
		});

		it("should handle empty instructions string", async () => {
			mockReq.body.instructions = "";

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "test-autofill-id",
				coverLetter: expect.any(String),
			});
		});

		it("should handle very long instructions", async () => {
			mockReq.body.instructions = "a".repeat(500);

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
		});

		it("should handle special characters in instructions", async () => {
			mockReq.body.instructions =
				"Focus on: leadership & teamwork (5+ years), problem-solving!";

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
		});

		it("should handle unicode characters in instructions", async () => {
			mockReq.body.instructions =
				"Highlight 日本語 skills and émigré experience";

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
		});

		it("should handle multiple setting combinations", async () => {
			const combinations = [
				{
					length: "short" as const,
					format: "bullet" as const,
				},
				{
					length: "detailed" as const,
					format: "paragraph" as const,
				},
				{
					length: "medium" as const,
					format: "bullet" as const,
				},
			];

			for (const settings of combinations) {
				mockReq.body.settings = settings;

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should return cover letter as string", async () => {
			await generateCoverLetterController(mockReq as never, mockRes as never);

			const response = mockRes.json.mock.calls[0][0];
			expect(typeof response.coverLetter).toBe("string");
			expect(response.coverLetter.length).toBeGreaterThan(0);
		});

		it("should include autofillId in response", async () => {
			await generateCoverLetterController(mockReq as never, mockRes as never);

			const response = mockRes.json.mock.calls[0][0];
			expect(response).toHaveProperty("autofillId");
			expect(response.autofillId).toBe("test-autofill-id");
		});

		it("should handle minimal request with only autofillId", async () => {
			mockReq.query.autofillId = "minimal-autofill-id";
			mockReq.body = {};

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "minimal-autofill-id",
				coverLetter: expect.any(String),
			});
		});

		it("should handle request with only instructions", async () => {
			mockReq.body = {
				instructions: "Focus on technical skills",
			};

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
		});

		it("should handle request with only settings", async () => {
			mockReq.body = {
				settings: {
					length: "short",
					format: "paragraph",
				},
			};

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
		});

		it("should handle whitespace-only instructions", async () => {
			mockReq.body.instructions = "   \n\t  ";

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
		});

		it("should handle autofillId with special characters", async () => {
			mockReq.query.autofillId = "autofill-123-abc_def";

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.json).toHaveBeenCalledWith(
				expect.objectContaining({
					autofillId: "autofill-123-abc_def",
				}),
			);
		});

		it("should call controller multiple times with same data", async () => {
			for (let i = 0; i < 3; i++) {
				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}

			expect(mockRes.status).toHaveBeenCalledTimes(3);
			expect(mockRes.json).toHaveBeenCalledTimes(3);
		});

		it("should handle concurrent requests", async () => {
			const requests = Array(5)
				.fill(null)
				.map(() =>
					generateCoverLetterController(mockReq as never, mockRes as never),
				);

			await Promise.all(requests);

			expect(mockRes.status).toHaveBeenCalledTimes(5);
		});

		it("should preserve user context across calls", async () => {
			const userId = mockReq.user.id;

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockReq.user.id).toBe(userId);
		});

		it("should handle different user IDs", async () => {
			const userIds = ["user-1", "user-2", "user-3"];

			for (const userId of userIds) {
				mockReq.user.id = userId;

				mockedAutofillModel.findByAutofillId.mockResolvedValue({
					userId,
					uploadReference: "test-upload-id",
					cvDataReference: "test-cv-data-id",
					autofillId: "test-autofill-id",
					formReference: "test-form-id",
					data: [],
					createdAt: new Date(),
					updatedAt: new Date(),
				} as never);

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should return consistent response structure", async () => {
			await generateCoverLetterController(mockReq as never, mockRes as never);

			const response = mockRes.json.mock.calls[0][0];
			expect(Object.keys(response)).toEqual(
				expect.arrayContaining(["autofillId", "coverLetter"]),
			);
			expect(Object.keys(response).length).toBe(2);
		});

		it("should handle multiple setting combinations", async () => {
			const combinations = [
				{
					length: "short" as const,
					format: "bullet" as const,
				},
				{
					length: "detailed" as const,
					format: "paragraph" as const,
				},
				{
					length: "medium" as const,
					format: "bullet" as const,
				},
			];

			for (const settings of combinations) {
				mockReq.body.settings = settings;

				await generateCoverLetterController(mockReq as never, mockRes as never);

				expect(mockRes.status).toHaveBeenCalledWith(200);
			}
		});

		it("should handle all settings at boundary values", async () => {
			mockReq.body.settings = {
				length: "short",
				format: "paragraph",
			};

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);

			mockReq.body.settings = {
				length: "detailed",
				format: "bullet",
			};

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
		});

		it("should handle instructions with newlines", async () => {
			mockReq.body.instructions =
				"Line 1: Focus on leadership\nLine 2: Highlight technical skills\nLine 3: Mention team collaboration";

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
		});

		it("should handle instructions with quotes", async () => {
			mockReq.body.instructions =
				"Emphasize \"innovation\" and 'problem-solving' abilities";

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(200);
		});

		it("should not mutate request object", async () => {
			const originalBody = JSON.parse(JSON.stringify(mockReq.body));

			await generateCoverLetterController(mockReq as never, mockRes as never);

			expect(mockReq.body).toEqual(originalBody);
		});

		it("should handle rapid sequential calls", async () => {
			for (let i = 0; i < 10; i++) {
				await generateCoverLetterController(mockReq as never, mockRes as never);
			}

			expect(mockRes.status).toHaveBeenCalledTimes(10);
			expect(mockRes.json).toHaveBeenCalledTimes(10);
		});
	});
});
