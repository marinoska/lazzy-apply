import type { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreditsTracker } from "./balanceTracker.js";
import { UsageModel } from "./model/usage.model.js";
import { UserBalanceModel } from "./model/userBalance.model.js";

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

describe("CreditsTracker", () => {
	const userId = "test-user-id";
	const mockReferenceId =
		"507f1f77bcf86cd799439011" as unknown as Types.ObjectId;
	const mockSession = {} as never;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("grant", () => {
		it("should grant credits and persist with correct data", async () => {
			const tracker = new CreditsTracker(userId, {
				referenceTable: "autofill",
			});

			tracker.setReference(mockReferenceId);
			await tracker.grant(100, "signup_bonus", mockSession);

			expect(UsageModel.create).toHaveBeenCalledTimes(1);
			expect(UsageModel.create).toHaveBeenCalledWith(
				[
					{
						referenceTable: "autofill",
						reference: mockReferenceId,
						userId,
						type: "signup_bonus",
						creditsDelta: 100,
						promptTokens: 0,
						completionTokens: 0,
						inputCost: 0,
						outputCost: 0,
						totalCost: 0,
					},
				],
				{ session: mockSession },
			);

			expect(UserBalanceModel.updateBalance).toHaveBeenCalledTimes(1);
			expect(UserBalanceModel.updateBalance).toHaveBeenCalledWith(
				userId,
				100,
				mockSession,
			);
		});

		it("should throw error when credits are zero", async () => {
			const tracker = new CreditsTracker(userId, {
				referenceTable: "autofill",
			});

			tracker.setReference(mockReferenceId);

			await expect(
				tracker.grant(0, "signup_bonus", mockSession),
			).rejects.toThrow("Credits must be positive");

			expect(UsageModel.create).not.toHaveBeenCalled();
		});

		it("should throw error when credits are negative", async () => {
			const tracker = new CreditsTracker(userId, {
				referenceTable: "autofill",
			});

			tracker.setReference(mockReferenceId);

			await expect(
				tracker.grant(-50, "signup_bonus", mockSession),
			).rejects.toThrow("Credits must be positive");

			expect(UsageModel.create).not.toHaveBeenCalled();
		});

		it("should throw error when reference is not set", async () => {
			const tracker = new CreditsTracker(userId, {
				referenceTable: "autofill",
			});

			await expect(
				tracker.grant(100, "signup_bonus", mockSession),
			).rejects.toThrow("Reference must be set before tracking usage");

			expect(UsageModel.create).not.toHaveBeenCalled();
		});

		it("should handle multiple credit grants in sequence", async () => {
			const tracker = new CreditsTracker(userId, {
				referenceTable: "autofill",
			});

			tracker.setReference(mockReferenceId);
			await tracker.grant(100, "signup_bonus", mockSession);
			await tracker.grant(50, "referral_bonus", mockSession);

			expect(UsageModel.create).toHaveBeenCalledTimes(2);

			expect(UsageModel.create).toHaveBeenNthCalledWith(
				1,
				[
					{
						referenceTable: "autofill",
						reference: mockReferenceId,
						userId,
						type: "signup_bonus",
						creditsDelta: 100,
						promptTokens: 0,
						completionTokens: 0,
						inputCost: 0,
						outputCost: 0,
						totalCost: 0,
					},
				],
				{ session: mockSession },
			);

			expect(UsageModel.create).toHaveBeenNthCalledWith(
				2,
				[
					{
						referenceTable: "autofill",
						reference: mockReferenceId,
						userId,
						type: "referral_bonus",
						creditsDelta: 50,
						promptTokens: 0,
						completionTokens: 0,
						inputCost: 0,
						outputCost: 0,
						totalCost: 0,
					},
				],
				{ session: mockSession },
			);

			expect(UserBalanceModel.updateBalance).toHaveBeenCalledTimes(2);
		});

		it("should handle different credit types", async () => {
			const tracker = new CreditsTracker(userId, {
				referenceTable: "autofill",
			});

			tracker.setReference(mockReferenceId);
			await tracker.grant(200, "admin_grant", mockSession);

			expect(UsageModel.create).toHaveBeenCalledWith(
				[
					{
						referenceTable: "autofill",
						reference: mockReferenceId,
						userId,
						type: "admin_grant",
						creditsDelta: 200,
						promptTokens: 0,
						completionTokens: 0,
						inputCost: 0,
						outputCost: 0,
						totalCost: 0,
					},
				],
				{ session: mockSession },
			);
		});

		it("should use correct reference table", async () => {
			const tracker = new CreditsTracker(userId, {
				referenceTable: "cv_data",
			});

			tracker.setReference(mockReferenceId);
			await tracker.grant(75, "promotion", mockSession);

			expect(UsageModel.create).toHaveBeenCalledWith(
				[
					{
						referenceTable: "cv_data",
						reference: mockReferenceId,
						userId,
						type: "promotion",
						creditsDelta: 75,
						promptTokens: 0,
						completionTokens: 0,
						inputCost: 0,
						outputCost: 0,
						totalCost: 0,
					},
				],
				{ session: mockSession },
			);
		});
	});
});
