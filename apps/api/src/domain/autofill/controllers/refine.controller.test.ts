import { beforeEach, describe, expect, it, vi } from "vitest";
import { refineFieldValue } from "../llm/index.js";
import { AutofillModel } from "../model/autofill.model.js";
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
		findByAutofillId: vi.fn(() => ({
			populate: vi.fn(),
		})),
	},
}));

const mockedRefineFieldValue = vi.mocked(refineFieldValue);
const mockedAutofillModel = vi.mocked(AutofillModel);

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

		const mockPopulate = vi.fn().mockResolvedValue({
			userId: "test-user-id",
			uploadReference: { toString: () => "test-upload-id" },
			cvDataReference: {
				rawText: "John Doe, Software Engineer",
			},
		});

		mockedAutofillModel.findByAutofillId.mockReturnValue({
			populate: mockPopulate,
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
		});
	});

	describe("refineController", () => {
		it("should call refineFieldValue and return refined answer", async () => {
			await refineController(mockReq as never, mockRes as never);

			expect(mockedAutofillModel.findByAutofillId).toHaveBeenCalledWith(
				"test-autofill-id",
			);
			expect(mockedRefineFieldValue).toHaveBeenCalledWith({
				cvRawText: "John Doe, Software Engineer",
				fieldLabel: "Full Name",
				fieldDescription: "Please enter your full name",
				existingAnswer: "John Doe",
				userInstructions: "Make it more formal",
			});

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

		it("should fetch CV raw text from populated autofill session", async () => {
			mockReq.body.fieldLabel = "Custom Label";
			mockReq.body.fieldDescription = "Custom Description";
			mockReq.body.fieldText = "Custom Answer";
			mockReq.body.userInstructions = "Custom Instructions";

			await refineController(mockReq as never, mockRes as never);

			expect(mockedAutofillModel.findByAutofillId).toHaveBeenCalledWith(
				"test-autofill-id",
			);
			expect(mockedRefineFieldValue).toHaveBeenCalledWith({
				cvRawText: "John Doe, Software Engineer",
				fieldLabel: "Custom Label",
				fieldDescription: "Custom Description",
				existingAnswer: "Custom Answer",
				userInstructions: "Custom Instructions",
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
			});

			await refineController(mockReq as never, mockRes as never);

			expect(mockRes.json).toHaveBeenCalledWith({
				autofillId: "test-autofill-id",
				fieldHash: "test-field-hash",
				refinedText: "Different refined text",
			});
		});

		it("should return 404 when autofill session not found", async () => {
			mockedAutofillModel.findByAutofillId.mockReturnValueOnce({
				populate: vi.fn().mockResolvedValue(null),
			} as never);

			await refineController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(404);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "Autofill session not found",
			});
		});

		it("should return 404 when CV data not found", async () => {
			mockedAutofillModel.findByAutofillId.mockReturnValueOnce({
				populate: vi.fn().mockResolvedValue({
					userId: "test-user-id",
					uploadReference: { toString: () => "test-upload-id" },
					cvDataReference: null,
				}),
			} as never);

			await refineController(mockReq as never, mockRes as never);

			expect(mockRes.status).toHaveBeenCalledWith(404);
			expect(mockRes.json).toHaveBeenCalledWith({
				error: "CV data not found",
			});
		});

		it("should throw Unauthorized when user does not own autofill session", async () => {
			mockedAutofillModel.findByAutofillId.mockReturnValueOnce({
				populate: vi.fn().mockResolvedValue({
					userId: "different-user-id",
					uploadReference: { toString: () => "test-upload-id" },
					cvDataReference: { rawText: "CV text" },
				}),
			} as never);

			await expect(
				refineController(mockReq as never, mockRes as never),
			).rejects.toThrow("Unauthorized access to autofill session");
		});
	});
});
