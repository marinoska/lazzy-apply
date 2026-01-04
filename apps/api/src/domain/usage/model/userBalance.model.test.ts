import { beforeEach, describe, expect, it } from "vitest";
import { UserBalanceModel } from "./userBalance.model.js";

describe("UserBalanceModel", () => {
	beforeEach(async () => {
		await UserBalanceModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
	});

	describe("updateBalance", () => {
		it("should create a new balance record with upsert", async () => {
			const userId = "test-user-1";
			const promptTokens = 100;
			const completionTokens = 50;

			const result = await UserBalanceModel.updateBalance(
				userId,
				promptTokens,
				completionTokens,
			);

			expect(result.userId).toBe(userId);
			expect(result.inputTokens).toBe(100);
			expect(result.outputTokens).toBe(50);
		});

		it("should increment existing balance", async () => {
			const userId = "test-user-2";

			await UserBalanceModel.updateBalance(userId, 100, 50);
			const result = await UserBalanceModel.updateBalance(userId, 200, 75);

			expect(result.inputTokens).toBe(300);
			expect(result.outputTokens).toBe(125);
		});

		it("should handle separate input and output token increments", async () => {
			const userId = "test-user-3";

			await UserBalanceModel.updateBalance(userId, 500, 100);
			const result = await UserBalanceModel.updateBalance(userId, 300, 200);

			expect(result.inputTokens).toBe(800);
			expect(result.outputTokens).toBe(300);
		});

		it("should work within a session", async () => {
			const userId = "test-user-4";
			const session = await UserBalanceModel.startSession();

			try {
				await session.withTransaction(async () => {
					await UserBalanceModel.updateBalance(userId, 100, 50, session);
					const result = await UserBalanceModel.updateBalance(
						userId,
						200,
						75,
						session,
					);

					expect(result.inputTokens).toBe(300);
					expect(result.outputTokens).toBe(125);
				});
			} finally {
				await session.endSession();
			}

			const finalBalance = await UserBalanceModel.getBalance(userId);
			expect(finalBalance.inputTokens).toBe(300);
			expect(finalBalance.outputTokens).toBe(125);
			expect(finalBalance.totalTokens).toBe(425);
		});
	});

	describe("getBalance", () => {
		it("should return 0 for non-existent user", async () => {
			const balance = await UserBalanceModel.getBalance("non-existent-user");
			expect(balance.inputTokens).toBe(0);
			expect(balance.outputTokens).toBe(0);
			expect(balance.totalTokens).toBe(0);
		});

		it("should return the correct balance for existing user", async () => {
			const userId = "test-user-5";

			await UserBalanceModel.updateBalance(userId, 1000, 500);
			const balance = await UserBalanceModel.getBalance(userId);

			expect(balance.inputTokens).toBe(1000);
			expect(balance.outputTokens).toBe(500);
			expect(balance.totalTokens).toBe(1500);
		});

		it("should calculate total tokens correctly", async () => {
			const userId = "test-user-6";

			await UserBalanceModel.updateBalance(userId, 250, 150);
			await UserBalanceModel.updateBalance(userId, 100, 50);
			const balance = await UserBalanceModel.getBalance(userId);

			expect(balance.inputTokens).toBe(350);
			expect(balance.outputTokens).toBe(200);
			expect(balance.totalTokens).toBe(550);
		});
	});
});
