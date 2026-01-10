import type { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UsageModel } from "./model/usage.model.js";
import { UserBalanceModel } from "./model/userBalance.model.js";
import { createEmptyUsage, UsageTracker } from "./usageTracker.js";

vi.mock("./model/usage.model.js", () => ({
	UsageModel: {
		create: vi.fn(),
	},
}));

vi.mock("./model/userBalance.model.js", () => ({
	UserBalanceModel: {
		updateBalance: vi.fn(),
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

describe("UsageTracker", () => {
	const userId = "test-user-id";
	const mockReferenceId =
		"507f1f77bcf86cd799439011" as unknown as Types.ObjectId;
	const mockSession = {} as never;
	const mockUsageConfig = {
		model: "gpt-4o-mini",
		inputPricePer1M: 0.15,
		outputPricePer1M: 0.6,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("persistUsage", () => {
		it("should persist all usage entries with correct reference table", async () => {
			const tracker = new UsageTracker(
				userId,
				{ referenceTable: "autofill" },
				mockUsageConfig,
			);

			tracker.setReference(mockReferenceId);
			tracker.setUsage("form_fields_classification", {
				promptTokens: 100,
				completionTokens: 50,
			});

			tracker.setUsage("form_fields_inference", {
				promptTokens: 200,
				completionTokens: 100,
			});

			await tracker.persist(mockSession);

			expect(UsageModel.create).toHaveBeenCalledTimes(2);
			expect(UsageModel.create).toHaveBeenCalledWith(
				[
					expect.objectContaining({
						referenceTable: "autofill",
						type: "form_fields_classification",
						model: "gpt-4o-mini",
						promptTokens: 100,
						completionTokens: 50,
					}),
				],
				{ session: mockSession },
			);
			expect(UsageModel.create).toHaveBeenCalledWith(
				[
					expect.objectContaining({
						referenceTable: "autofill",
						type: "form_fields_inference",
						model: "gpt-4o-mini",
						promptTokens: 200,
						completionTokens: 100,
					}),
				],
				{ session: mockSession },
			);
		});

		it("should work with cv_data reference table", async () => {
			const tracker = new UsageTracker(
				userId,
				{ referenceTable: "cv_data" },
				mockUsageConfig,
			);

			tracker.setReference(mockReferenceId);
			tracker.setUsage("cv_data_extraction", {
				promptTokens: 500,
				completionTokens: 200,
			});

			await tracker.persist(mockSession);

			expect(UsageModel.create).toHaveBeenCalledTimes(1);
			expect(UsageModel.create).toHaveBeenCalledWith(
				[
					expect.objectContaining({
						referenceTable: "cv_data",
						type: "cv_data_extraction",
						model: "gpt-4o-mini",
						promptTokens: 500,
						completionTokens: 200,
						userId,
					}),
				],
				{ session: mockSession },
			);
		});

		it("should silently skip usage with zero tokens", async () => {
			const tracker = new UsageTracker(
				userId,
				{ referenceTable: "autofill" },
				mockUsageConfig,
			);

			tracker.setReference(mockReferenceId);

			tracker.setUsage("form_fields_classification", {
				promptTokens: 0,
				completionTokens: 0,
			});

			await tracker.persist(mockSession);

			expect(UsageModel.create).not.toHaveBeenCalled();
		});

		it("should throw error if reference is not set", async () => {
			const tracker = new UsageTracker(
				userId,
				{ referenceTable: "autofill" },
				mockUsageConfig,
			);

			tracker.setUsage("form_fields_classification", {
				promptTokens: 100,
				completionTokens: 50,
			});

			await expect(tracker.persist(mockSession)).rejects.toThrow(
				"Reference must be set before tracking usage",
			);
		});

		it("should update user balance after persisting usage", async () => {
			const tracker = new UsageTracker(
				userId,
				{ referenceTable: "autofill" },
				mockUsageConfig,
			);

			tracker.setReference(mockReferenceId);
			tracker.setUsage("form_fields_classification", {
				promptTokens: 100,
				completionTokens: 50,
			});

			await tracker.persist(mockSession);

			expect(UserBalanceModel.updateBalance).toHaveBeenCalledTimes(1);
			expect(UserBalanceModel.updateBalance).toHaveBeenCalledWith(
				userId,
				expect.any(Number),
				mockSession,
			);
		});

		it("should update user balance for multiple usages", async () => {
			const tracker = new UsageTracker(
				userId,
				{ referenceTable: "autofill" },
				mockUsageConfig,
			);

			tracker.setReference(mockReferenceId);
			tracker.setUsage("form_fields_classification", {
				promptTokens: 100,
				completionTokens: 50,
			});

			tracker.setUsage("form_fields_inference", {
				promptTokens: 200,
				completionTokens: 100,
			});

			await tracker.persist(mockSession);

			expect(UserBalanceModel.updateBalance).toHaveBeenCalledTimes(2);
			expect(UserBalanceModel.updateBalance).toHaveBeenNthCalledWith(
				1,
				userId,
				expect.any(Number),
				mockSession,
			);
			expect(UserBalanceModel.updateBalance).toHaveBeenNthCalledWith(
				2,
				userId,
				expect.any(Number),
				mockSession,
			);
		});
	});
});

describe("createEmptyUsage", () => {
	it("should return an empty usage object with all zeros", () => {
		const usage = createEmptyUsage();

		expect(usage).toEqual({
			promptTokens: 0,
			completionTokens: 0,
		});
	});
});
