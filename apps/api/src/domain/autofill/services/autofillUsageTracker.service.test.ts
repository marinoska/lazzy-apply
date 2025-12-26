import type { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsageModel } from "@/domain/usage/index.js";
import { AutofillUsageTracker } from "./autofillUsageTracker.service.js";

vi.mock("@/domain/usage/index.js", () => ({
	UsageModel: {
		create: vi.fn(),
	},
}));

vi.mock("@/app/logger.js", () => ({
	createLogger: () => ({
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	}),
}));

describe("Autofill", () => {
	const userId = "test-user-id";
	const mockAutofillId =
		"507f1f77bcf86cd799439011" as unknown as Types.ObjectId;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("persist", () => {
		it("should persist autofill and all usage tracking", async () => {
			const autofill = new AutofillUsageTracker(userId);

			const mockAutofillDoc = {
				_id: mockAutofillId,
			};

			autofill.setClassificationUsage({
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
				inputCost: 0.01,
				outputCost: 0.02,
				totalCost: 0.03,
			});

			autofill.setJdFormMatchUsage({
				promptTokens: 200,
				completionTokens: 100,
				totalTokens: 300,
				inputCost: 0.02,
				outputCost: 0.04,
				totalCost: 0.06,
			});

			autofill.setInferenceUsage({
				promptTokens: 300,
				completionTokens: 150,
				totalTokens: 450,
				inputCost: 0.03,
				outputCost: 0.06,
				totalCost: 0.09,
			});

			autofill.setAutofill(mockAutofillDoc as never);
			await autofill.persistAllUsage();

			expect(UsageModel.create).toHaveBeenCalledTimes(3);
			expect(UsageModel.create).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "form_fields_classification",
					totalTokens: 150,
				}),
			);
			expect(UsageModel.create).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "jd_form_match",
					totalTokens: 300,
				}),
			);
			expect(UsageModel.create).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "form_fields_inference",
					totalTokens: 450,
				}),
			);
		});

		it("should skip persisting usage with zero tokens", async () => {
			const autofill = new AutofillUsageTracker(userId);

			const mockAutofillDoc = {
				_id: mockAutofillId,
			};

			autofill.setClassificationUsage({
				promptTokens: 0,
				completionTokens: 0,
				totalTokens: 0,
				inputCost: 0,
				outputCost: 0,
				totalCost: 0,
			});

			autofill.setAutofill(mockAutofillDoc as never);
			await autofill.persistAllUsage();

			expect(UsageModel.create).not.toHaveBeenCalled();
		});

		it("should skip persisting null jd form match usage", async () => {
			const autofill = new AutofillUsageTracker(userId);

			const mockAutofillDoc = {
				_id: mockAutofillId,
			};

			autofill.setJdFormMatchUsage(null);

			autofill.setAutofill(mockAutofillDoc as never);
			await autofill.persistAllUsage();

			expect(UsageModel.create).not.toHaveBeenCalled();
		});
	});
});
