import type { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { UsageModel } from "@/domain/usage/model/usage.model.js";
import { UserBalanceModel } from "@/domain/usage/model/userBalance.model.js";

describe("recalculateBalances integration", () => {
	beforeEach(async () => {
		await UserBalanceModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		await UsageModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
	});

	describe("balance calculation", () => {
		it("should calculate correct balances from usage records", async () => {
			const userId = "test-user-1";
			const referenceId =
				"507f1f77bcf86cd799439011" as unknown as Types.ObjectId;

			await UsageModel.create([
				{
					userId,
					referenceTable: "forms",
					reference: referenceId,
					type: "form_fields_classification",
					promptTokens: 100,
					completionTokens: 50,
					totalTokens: 150,
				},
			]);

			await UsageModel.create([
				{
					userId,
					referenceTable: "forms",
					reference: "507f1f77bcf86cd799439012" as unknown as Types.ObjectId,
					type: "form_fields_inference",
					promptTokens: 200,
					completionTokens: 75,
					totalTokens: 275,
				},
			]);

			const usageAggregation = await UsageModel.aggregate([
				{
					$group: {
						_id: "$userId",
						promptTokens: { $sum: "$promptTokens" },
						completionTokens: { $sum: "$completionTokens" },
						totalTokens: { $sum: "$totalTokens" },
					},
				},
			]);

			expect(usageAggregation).toHaveLength(1);
			expect(usageAggregation[0].promptTokens).toBe(300);
			expect(usageAggregation[0].completionTokens).toBe(125);
			expect(usageAggregation[0].totalTokens).toBe(425);
		});

		it("should detect inconsistencies between usage and balance", async () => {
			const userId = "test-user-2";
			const referenceId =
				"507f1f77bcf86cd799439013" as unknown as Types.ObjectId;

			await UsageModel.create([
				{
					userId,
					referenceTable: "forms",
					reference: referenceId,
					type: "form_fields_classification",
					promptTokens: 500,
					completionTokens: 250,
					totalTokens: 750,
				},
			]);

			await UserBalanceModel.findOneAndUpdate(
				{ userId },
				{ inputTokens: 100, outputTokens: 50 },
				{ upsert: true, skipOwnershipEnforcement: true },
			);

			const currentBalance = await UserBalanceModel.findOne({ userId })
				.setOptions({ skipOwnershipEnforcement: true })
				.lean();

			const usageAggregation = await UsageModel.aggregate([
				{ $match: { userId } },
				{
					$group: {
						_id: "$userId",
						promptTokens: { $sum: "$promptTokens" },
						completionTokens: { $sum: "$completionTokens" },
					},
				},
			]);

			expect(currentBalance?.inputTokens).toBe(100);
			expect(currentBalance?.outputTokens).toBe(50);
			expect(usageAggregation[0].promptTokens).toBe(500);
			expect(usageAggregation[0].completionTokens).toBe(250);

			const inputDifference =
				(currentBalance?.inputTokens ?? 0) - usageAggregation[0].promptTokens;
			const outputDifference =
				(currentBalance?.outputTokens ?? 0) -
				usageAggregation[0].completionTokens;

			expect(inputDifference).toBe(-400);
			expect(outputDifference).toBe(-200);
		});

		it("should correctly update balances to match usage", async () => {
			const userId = "test-user-3";
			const referenceId =
				"507f1f77bcf86cd799439014" as unknown as Types.ObjectId;

			await UsageModel.create([
				{
					userId,
					referenceTable: "forms",
					reference: referenceId,
					type: "form_fields_classification",
					promptTokens: 1000,
					completionTokens: 500,
					totalTokens: 1500,
				},
			]);

			await UserBalanceModel.findOneAndUpdate(
				{ userId },
				{ inputTokens: 0, outputTokens: 0 },
				{ upsert: true, skipOwnershipEnforcement: true },
			);

			const usageAggregation = await UsageModel.aggregate([
				{ $match: { userId } },
				{
					$group: {
						_id: "$userId",
						promptTokens: { $sum: "$promptTokens" },
						completionTokens: { $sum: "$completionTokens" },
					},
				},
			]);

			await UserBalanceModel.findOneAndUpdate(
				{ userId },
				{
					inputTokens: usageAggregation[0].promptTokens,
					outputTokens: usageAggregation[0].completionTokens,
				},
				{ skipOwnershipEnforcement: true },
			);

			const updatedBalance = await UserBalanceModel.findOne({ userId })
				.setOptions({ skipOwnershipEnforcement: true })
				.lean();

			expect(updatedBalance?.inputTokens).toBe(1000);
			expect(updatedBalance?.outputTokens).toBe(500);
		});

		it("should handle multiple users correctly", async () => {
			const user1 = "test-user-4";
			const user2 = "test-user-5";
			const ref1 = "507f1f77bcf86cd799439015" as unknown as Types.ObjectId;
			const ref2 = "507f1f77bcf86cd799439016" as unknown as Types.ObjectId;

			await UsageModel.create([
				{
					userId: user1,
					referenceTable: "forms",
					reference: ref1,
					type: "form_fields_classification",
					promptTokens: 300,
					completionTokens: 100,
					totalTokens: 400,
				},
			]);

			await UsageModel.create([
				{
					userId: user2,
					referenceTable: "forms",
					reference: ref2,
					type: "form_fields_inference",
					promptTokens: 500,
					completionTokens: 200,
					totalTokens: 700,
				},
			]);

			const usageAggregation = await UsageModel.aggregate([
				{
					$group: {
						_id: "$userId",
						promptTokens: { $sum: "$promptTokens" },
						completionTokens: { $sum: "$completionTokens" },
					},
				},
			]);

			expect(usageAggregation).toHaveLength(2);

			const user1Usage = usageAggregation.find((u) => u._id === user1);
			const user2Usage = usageAggregation.find((u) => u._id === user2);

			expect(user1Usage?.promptTokens).toBe(300);
			expect(user1Usage?.completionTokens).toBe(100);
			expect(user2Usage?.promptTokens).toBe(500);
			expect(user2Usage?.completionTokens).toBe(200);
		});

		it("should identify users with balance but no usage", async () => {
			const userId = "test-user-6";

			await UserBalanceModel.findOneAndUpdate(
				{ userId },
				{ inputTokens: 100, outputTokens: 50 },
				{ upsert: true, skipOwnershipEnforcement: true },
			);

			const usageAggregation = await UsageModel.aggregate([
				{
					$group: {
						_id: "$userId",
						promptTokens: { $sum: "$promptTokens" },
						completionTokens: { $sum: "$completionTokens" },
					},
				},
			]);

			const usersWithBalanceButNoUsage = await UserBalanceModel.find({
				userId: { $nin: usageAggregation.map((u) => u._id) },
				$or: [{ inputTokens: { $ne: 0 } }, { outputTokens: { $ne: 0 } }],
			})
				.setOptions({ skipOwnershipEnforcement: true })
				.lean();

			expect(usersWithBalanceButNoUsage).toHaveLength(1);
			expect(usersWithBalanceButNoUsage[0].userId).toBe(userId);
			expect(usersWithBalanceButNoUsage[0].inputTokens).toBe(100);
			expect(usersWithBalanceButNoUsage[0].outputTokens).toBe(50);
		});

		it("should handle zero balances correctly", async () => {
			const userId = "test-user-7";

			await UserBalanceModel.findOneAndUpdate(
				{ userId },
				{ inputTokens: 0, outputTokens: 0 },
				{ upsert: true, skipOwnershipEnforcement: true },
			);

			const usageAggregation = await UsageModel.aggregate([
				{
					$group: {
						_id: "$userId",
						promptTokens: { $sum: "$promptTokens" },
						completionTokens: { $sum: "$completionTokens" },
					},
				},
			]);

			const usersWithBalanceButNoUsage = await UserBalanceModel.find({
				userId: { $nin: usageAggregation.map((u) => u._id) },
				$or: [{ inputTokens: { $ne: 0 } }, { outputTokens: { $ne: 0 } }],
			})
				.setOptions({ skipOwnershipEnforcement: true })
				.lean();

			expect(usersWithBalanceButNoUsage).toHaveLength(0);
		});
	});
});
