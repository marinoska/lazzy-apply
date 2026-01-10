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
					model: "gpt-4o-mini",
					creditsDelta: -0.01,
					promptTokens: 100,
					completionTokens: 50,
					inputCost: 0.005,
					outputCost: 0.005,
					totalCost: 0.01,
				},
			]);

			await UsageModel.create([
				{
					userId,
					referenceTable: "forms",
					reference: "507f1f77bcf86cd799439012" as unknown as Types.ObjectId,
					type: "form_fields_inference",
					model: "gpt-4o-mini",
					creditsDelta: -0.02,
					promptTokens: 200,
					completionTokens: 75,
					inputCost: 0.01,
					outputCost: 0.01,
					totalCost: 0.02,
				},
			]);

			const usageAggregation = await UsageModel.aggregate([
				{
					$group: {
						_id: "$userId",
						totalCredits: { $sum: "$creditsDelta" },
					},
				},
			]);

			expect(usageAggregation).toHaveLength(1);
			expect(usageAggregation[0].totalCredits).toBe(-0.03);
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
					model: "gpt-4o-mini",
					creditsDelta: -0.05,
					promptTokens: 500,
					completionTokens: 250,
					inputCost: 0.025,
					outputCost: 0.025,
					totalCost: 0.05,
				},
			]);

			await UserBalanceModel.findOneAndUpdate(
				{ userId },
				{ creditBalance: 0.1 },
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
						totalCredits: { $sum: "$creditsDelta" },
					},
				},
			]);

			expect(currentBalance?.creditBalance).toBe(0.1);
			expect(usageAggregation[0].totalCredits).toBe(-0.05);

			const creditDifference =
				(currentBalance?.creditBalance ?? 0) + usageAggregation[0].totalCredits;

			expect(creditDifference).toBe(0.05);
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
					model: "gpt-4o-mini",
					creditsDelta: -0.1,
					promptTokens: 1000,
					completionTokens: 500,
					inputCost: 0.05,
					outputCost: 0.05,
					totalCost: 0.1,
				},
			]);

			await UserBalanceModel.findOneAndUpdate(
				{ userId },
				{ creditBalance: 0 },
				{ upsert: true, skipOwnershipEnforcement: true },
			);

			const usageAggregation = await UsageModel.aggregate([
				{ $match: { userId } },
				{
					$group: {
						_id: "$userId",
						totalCredits: { $sum: "$creditsDelta" },
					},
				},
			]);

			await UserBalanceModel.findOneAndUpdate(
				{ userId },
				{
					creditBalance: -usageAggregation[0].totalCredits,
				},
				{ skipOwnershipEnforcement: true },
			);

			const updatedBalance = await UserBalanceModel.findOne({ userId })
				.setOptions({ skipOwnershipEnforcement: true })
				.lean();

			expect(updatedBalance?.creditBalance).toBe(0.1);
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
					model: "gpt-4o-mini",
					creditsDelta: -0.03,
					promptTokens: 300,
					completionTokens: 100,
					inputCost: 0.015,
					outputCost: 0.015,
					totalCost: 0.03,
				},
			]);

			await UsageModel.create([
				{
					userId: user2,
					referenceTable: "forms",
					reference: ref2,
					type: "form_fields_inference",
					model: "gpt-4o-mini",
					creditsDelta: -0.05,
					promptTokens: 500,
					completionTokens: 200,
					inputCost: 0.025,
					outputCost: 0.025,
					totalCost: 0.05,
				},
			]);

			const usageAggregation = await UsageModel.aggregate([
				{
					$group: {
						_id: "$userId",
						totalCredits: { $sum: "$creditsDelta" },
					},
				},
			]);

			expect(usageAggregation).toHaveLength(2);

			const user1Usage = usageAggregation.find((u) => u._id === user1);
			const user2Usage = usageAggregation.find((u) => u._id === user2);

			expect(user1Usage?.totalCredits).toBe(-0.03);
			expect(user2Usage?.totalCredits).toBe(-0.05);
		});

		it("should identify users with balance but no usage", async () => {
			const userId = "test-user-6";

			await UserBalanceModel.findOneAndUpdate(
				{ userId },
				{ creditBalance: 0.15 },
				{ upsert: true, skipOwnershipEnforcement: true },
			);

			const usageAggregation = await UsageModel.aggregate([
				{
					$group: {
						_id: "$userId",
						totalCredits: { $sum: "$creditsDelta" },
					},
				},
			]);

			const usersWithBalanceButNoUsage = await UserBalanceModel.find({
				userId: { $nin: usageAggregation.map((u) => u._id) },
				creditBalance: { $ne: 0 },
			})
				.setOptions({ skipOwnershipEnforcement: true })
				.lean();

			expect(usersWithBalanceButNoUsage).toHaveLength(1);
			expect(usersWithBalanceButNoUsage[0].userId).toBe(userId);
			expect(usersWithBalanceButNoUsage[0].creditBalance).toBe(0.15);
		});

		it("should handle zero balances correctly", async () => {
			const userId = "test-user-7";

			await UserBalanceModel.findOneAndUpdate(
				{ userId },
				{ creditBalance: 0 },
				{ upsert: true, skipOwnershipEnforcement: true },
			);

			const usageAggregation = await UsageModel.aggregate([
				{
					$group: {
						_id: "$userId",
						totalCredits: { $sum: "$creditsDelta" },
					},
				},
			]);

			const usersWithBalanceButNoUsage = await UserBalanceModel.find({
				userId: { $nin: usageAggregation.map((u) => u._id) },
				creditBalance: { $ne: 0 },
			})
				.setOptions({ skipOwnershipEnforcement: true })
				.lean();

			expect(usersWithBalanceButNoUsage).toHaveLength(0);
		});
	});
});
