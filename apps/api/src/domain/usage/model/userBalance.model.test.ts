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
			const creditsDelta = 150;

			const result = await UserBalanceModel.updateBalance(userId, creditsDelta);

			expect(result.userId).toBe(userId);
			expect(result.creditBalance).toBe(150);
		});

		it("should increment existing balance", async () => {
			const userId = "test-user-2";

			await UserBalanceModel.updateBalance(userId, 150);
			const result = await UserBalanceModel.updateBalance(userId, 275);

			expect(result.creditBalance).toBe(425);
		});

		it("should handle multiple credit increments", async () => {
			const userId = "test-user-3";

			await UserBalanceModel.updateBalance(userId, 600);
			const result = await UserBalanceModel.updateBalance(userId, 500);

			expect(result.creditBalance).toBe(1100);
		});

		it("should work within a session", async () => {
			const userId = "test-user-4";
			const session = await UserBalanceModel.startSession();

			try {
				await session.withTransaction(async () => {
					await UserBalanceModel.updateBalance(userId, 150, session);
					const result = await UserBalanceModel.updateBalance(
						userId,
						275,
						session,
					);

					expect(result.creditBalance).toBe(425);
				});
			} finally {
				await session.endSession();
			}

			const finalBalance = await UserBalanceModel.getBalance(userId);
			expect(finalBalance.creditBalance).toBe(425);
		});
	});

	describe("getBalance", () => {
		it("should return 0 for non-existent user", async () => {
			const balance = await UserBalanceModel.getBalance("non-existent-user");
			expect(balance.creditBalance).toBe(0);
		});

		it("should return the correct balance for existing user", async () => {
			const userId = "test-user-5";

			await UserBalanceModel.updateBalance(userId, 1500);
			const balance = await UserBalanceModel.getBalance(userId);

			expect(balance.creditBalance).toBe(1500);
		});

		it("should accumulate credits correctly", async () => {
			const userId = "test-user-6";

			await UserBalanceModel.updateBalance(userId, 400);
			await UserBalanceModel.updateBalance(userId, 150);
			const balance = await UserBalanceModel.getBalance(userId);

			expect(balance.creditBalance).toBe(550);
		});
	});
});
