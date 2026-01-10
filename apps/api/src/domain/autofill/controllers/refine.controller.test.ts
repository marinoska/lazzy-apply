import { beforeEach, describe, expect, it, vi } from "vitest";
import { refineFieldValue } from "../llm/index.js";
import { AutofillModel } from "../model/autofill.model.js";
import { AutofillRefineModel } from "../model/autofillRefine.model.js";
import { refineController } from "./refine.controller.js";

vi.mock("@/app/env.js", () => ({
	env: {
		LOG_LEVEL: "silent",
		NODE_ENV: "test",
	},
	getEnv: vi.fn(),
}));

vi.mock("../llm/index.js", () => ({
	refineFieldValue: vi.fn(),
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

vi.mock("../model/autofillRefine.model.js", () => ({
	AutofillRefineModel: {
		create: vi.fn(),
	},
	AUTOFILL_REFINE_MODEL_NAME: "autofill_refines",
}));

vi.mock("../services/cvContextVO.js", () => ({
	CVContextVO: {
		load: vi.fn(),
	},
}));

vi.mock("@/domain/usage/index.js", () => ({
	UsageTracker: vi.fn().mockImplementation(() => ({
		setReference: vi.fn(),
		setAutofillId: vi.fn(),
		setUsage: vi.fn(),
		persist: vi.fn(),
	})),
}));

import { UsageTracker } from "@/domain/usage/index.js";
import { CVContextVO } from "../services/cvContextVO.js";

const mockedRefineFieldValue = vi.mocked(refineFieldValue);
const mockedAutofillModel = vi.mocked(AutofillModel);
const mockedCVContextVO = vi.mocked(CVContextVO);
const mockedAutofillRefineModel = vi.mocked(AutofillRefineModel);
const mockedUsageTracker = vi.mocked(UsageTracker);

describe("refine.controller", () => {
	let mockReq: {
		user: { id: string };
		params: { autofillId: string; fieldHash: string };
		body: {
			fieldLabel: string;
			fieldDescription: string;
			fieldText: string;
			userInstructions: string;
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
			params: { autofillId: "test-autofill-id", fieldHash: "test-field-hash" },
			body: {
				fieldLabel: "Full Name",
				fieldDescription: "Please enter your full name",
				fieldText: "John Doe",
				userInstructions: "Make it more formal",
			},
		};

		mockedAutofillModel.findByAutofillId.mockResolvedValue({
			userId: "test-user-id",
			uploadReference: "test-upload-id",
			cvDataReference: "test-cv-data-id",
			autofillId: "test-autofill-id",
			formReference: "test-form-id",
			data: [],
			jdFacts: [{ key: "role", value: "Software Engineer", source: "jd" }],
			createdAt: new Date(),
			updatedAt: new Date(),
		} as never);

		mockedCVContextVO.load.mockResolvedValue({
			profileSignals: { seniority: "mid", techFocus: "backend" },
			summaryFacts: ["Software Engineer with 5 years experience"],
			experienceFacts: [
				{
					role: "Software Engineer",
					company: "Tech Co",
					facts: ["Built APIs", "Worked with databases"],
				},
			],
		} as never);

		mockedRefineFieldValue.mockResolvedValue({
			refinedAnswer: "John Michael Doe",
			usage: {
				promptTokens: 500,
				completionTokens: 100,
				totalTokens: 600,
				inputCost: 0.005,
				outputCost: 0.003,
				totalCost: 0.008,
			},
			routingDecision: {
				useProfileSignals: false,
				useSummaryFacts: true,
				useExperienceFacts: false,
				useJdFacts: false,
				reason: "Need summary facts for name refinement",
			},
		});

		mockedAutofillRefineModel.create.mockResolvedValue([
			{
				_id: "test-refine-id",
				autofillId: "test-autofill-id",
				hash: "test-field-hash",
				value: "John Michael Doe",
				fieldLabel: "Full Name",
				fieldDescription: "Please enter your full name",
				prevFieldText: "John Doe",
				userInstructions: "Make it more formal",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		] as never);
	});

	describe("refineController", () => {
		it("should call refineFieldValue and return refined answer", async () => {
			await refineController(mockReq as never, mockRes as never);

			expect(mockedAutofillModel.findByAutofillId).toHaveBeenCalledWith(
				"test-autofill-id",
				"test-user-id",
			);
			expect(mockedRefineFieldValue).toHaveBeenCalledWith({
				fieldLabel: "Full Name",
				fieldDescription: "Please enter your full name",
				existingAnswer: "John Doe",
				userInstructions: "Make it more formal",
				profileSignals: { seniority: "mid", techFocus: "backend" },
				summaryFacts: ["Software Engineer with 5 years experience"],
				experienceFacts: [
					{
						role: "Software Engineer",
						company: "Tech Co",
						facts: ["Built APIs", "Worked with databases"],
					},
				],
				jdFacts: [{ key: "role", value: "Software Engineer", source: "jd" }],
			});

			expect(mockedAutofillRefineModel.create).toHaveBeenCalledWith(
				[
					{
						userId: "test-user-id",
						autofillId: "test-autofill-id",
						hash: "test-field-hash",
						value: "John Michael Doe",
						fieldLabel: "Full Name",
						fieldDescription: "Please enter your full name",
						prevFieldText: "John Doe",
						userInstructions: "Make it more formal",
						routingDecision: {
							useProfileSignals: false,
							useSummaryFacts: true,
							useExperienceFacts: false,
							useJdFacts: false,
							reason: "Need summary facts for name refinement",
						},
					},
				],
				expect.objectContaining({ session: expect.anything() }),
			);

			expect(mockedUsageTracker).toHaveBeenCalledWith(
				"test-user-id",
				expect.objectContaining({
					referenceTable: "autofill_refines",
				}),
			);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "test-autofill-id",
				fieldHash: "test-field-hash",
				refinedText: "John Michael Doe",
			});
		});

		it("should throw Unauthorized when user is missing", async () => {
			const reqWithoutUser = {
				...mockReq,
				user: undefined,
			};

			await expect(
				refineController(reqWithoutUser as never, mockRes as never),
			).rejects.toThrow("Missing authenticated user");
		});

		it("should handle empty field description", async () => {
			mockReq.body.fieldDescription = "";

			await refineController(mockReq as never, mockRes as never);

			expect(mockedRefineFieldValue).toHaveBeenCalledWith(
				expect.objectContaining({
					fieldDescription: "",
				}),
			);
			expect(mockRes.status).toHaveBeenCalledWith(200);
		});

		it("should load CV context and pass structured data to refineFieldValue", async () => {
			mockReq.body.fieldLabel = "Custom Label";
			mockReq.body.fieldDescription = "Custom Description";
			mockReq.body.fieldText = "Custom Answer";
			mockReq.body.userInstructions = "Custom Instructions";

			await refineController(mockReq as never, mockRes as never);

			expect(mockedAutofillModel.findByAutofillId).toHaveBeenCalledWith(
				"test-autofill-id",
				"test-user-id",
			);
			expect(mockedCVContextVO.load).toHaveBeenCalledWith(
				"test-upload-id",
				"test-user-id",
			);
			expect(mockedRefineFieldValue).toHaveBeenCalledWith({
				fieldLabel: "Custom Label",
				fieldDescription: "Custom Description",
				existingAnswer: "Custom Answer",
				userInstructions: "Custom Instructions",
				profileSignals: { seniority: "mid", techFocus: "backend" },
				summaryFacts: ["Software Engineer with 5 years experience"],
				experienceFacts: [
					{
						role: "Software Engineer",
						company: "Tech Co",
						facts: ["Built APIs", "Worked with databases"],
					},
				],
				jdFacts: [{ key: "role", value: "Software Engineer", source: "jd" }],
			});
		});

		it("should return refined answer from LLM service", async () => {
			mockedRefineFieldValue.mockResolvedValueOnce({
				refinedAnswer: "Different refined text",
				usage: {
					promptTokens: 300,
					completionTokens: 50,
					totalTokens: 350,
					inputCost: 0.003,
					outputCost: 0.0015,
					totalCost: 0.0045,
				},
				routingDecision: {
					useProfileSignals: true,
					useSummaryFacts: false,
					useExperienceFacts: true,
					useJdFacts: true,
					reason: "Need experience and JD context",
				},
			});

			await refineController(mockReq as never, mockRes as never);

			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "test-autofill-id",
				fieldHash: "test-field-hash",
				refinedText: "Different refined text",
			});
		});

		it("should return 404 when autofill session not found", async () => {
			mockedAutofillModel.findByAutofillId.mockResolvedValueOnce(null);

			await refineController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(404);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "Autofill session not found",
			});
		});

		it("should return 404 when CV data not found", async () => {
			mockedAutofillModel.findByAutofillId.mockResolvedValueOnce({
				userId: "test-user-id",
				uploadReference: "test-upload-id",
				cvDataReference: "test-cv-data-id",
				autofillId: "test-autofill-id",
				formReference: "test-form-id",
				data: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			} as never);

			mockedCVContextVO.load.mockRejectedValueOnce(
				new Error("CV data not found"),
			);

			await expect(
				refineController(mockReq as never, mockRes as never),
			).rejects.toThrow("CV data not found");
		});

		it("should throw Unauthorized when user does not own autofill session", async () => {
			mockedAutofillModel.findByAutofillId.mockResolvedValueOnce({
				userId: "different-user-id",
				uploadReference: "test-upload-id",
				cvDataReference: "test-cv-data-id",
				autofillId: "test-autofill-id",
				formReference: "test-form-id",
				data: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			} as never);

			await expect(
				refineController(mockReq as never, mockRes as never),
			).rejects.toThrow("Unauthorized access to autofill session");
		});
	});
});
