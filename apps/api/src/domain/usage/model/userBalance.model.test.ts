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
			const delta = -150;

			const result = await UserBalanceModel.updateBalance(userId, delta);

			expect(result.userId).toBe(userId);
			expect(result.balance).toBe(-150);
		});

		it("should increment existing balance", async () => {
			const userId = "test-user-2";

			await UserBalanceModel.updateBalance(userId, -100);
			const result = await UserBalanceModel.updateBalance(userId, -50);

			expect(result.balance).toBe(-150);
		});

		it("should work with positive deltas", async () => {
			const userId = "test-user-3";

			await UserBalanceModel.updateBalance(userId, -200);
			const result = await UserBalanceModel.updateBalance(userId, 100);

			expect(result.balance).toBe(-100);
		});

		it("should work within a session", async () => {
			const userId = "test-user-4";
			const session = await UserBalanceModel.startSession();

			try {
				await session.withTransaction(async () => {
					await UserBalanceModel.updateBalance(userId, -100, session);
					const result = await UserBalanceModel.updateBalance(
						userId,
						-50,
						session,
					);

					expect(result.balance).toBe(-150);
				});
			} finally {
				await session.endSession();
			}

			const finalBalance = await UserBalanceModel.getBalance(userId);
			expect(finalBalance).toBe(-150);
		});
	});

	describe("getBalance", () => {
		it("should return 0 for non-existent user", async () => {
			const balance = await UserBalanceModel.getBalance("non-existent-user");
			expect(balance).toBe(0);
		});

		it("should return the correct balance for existing user", async () => {
			const userId = "test-user-5";

			await UserBalanceModel.updateBalance(userId, -300);
			const balance = await UserBalanceModel.getBalance(userId);

			expect(balance).toBe(-300);
		});
	});
});
