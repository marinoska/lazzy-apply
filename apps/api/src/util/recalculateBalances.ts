import { createLogger } from "@/app/logger.js";
import { connectToMongo, stopMongoClient } from "@/app/mongo.js";
import { UsageModel } from "@/domain/usage/model/usage.model.js";
import { UserBalanceModel } from "@/domain/usage/model/userBalance.model.js";

const logger = createLogger("recalculate-balances");

const isDryRun = process.argv.includes("--dry-run");

interface UserUsageSummary {
	userId: string;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	recordCount: number;
}

interface BalanceDiscrepancy {
	userId: string;
	currentInputTokens: number;
	currentOutputTokens: number;
	calculatedInputTokens: number;
	calculatedOutputTokens: number;
	inputDifference: number;
	outputDifference: number;
	usageRecordCount: number;
}

async function recalculateBalances() {
	try {
		await connectToMongo();
		logger.info(
			{ dryRun: isDryRun },
			isDryRun
				? "Starting balance recalculation (DRY RUN - no changes will be made)"
				: "Starting balance recalculation",
		);

		const usageAggregation = await UsageModel.aggregate<UserUsageSummary>([
			{
				$group: {
					_id: "$userId",
					promptTokens: { $sum: "$promptTokens" },
					completionTokens: { $sum: "$completionTokens" },
					totalTokens: { $sum: "$totalTokens" },
					recordCount: { $count: {} },
				},
			},
			{
				$project: {
					_id: 0,
					userId: "$_id",
					promptTokens: 1,
					completionTokens: 1,
					totalTokens: 1,
					recordCount: 1,
				},
			},
		]);

		logger.info(
			{ userCount: usageAggregation.length },
			"Aggregated usage data for users",
		);

		const discrepancies: BalanceDiscrepancy[] = [];
		let updatedCount = 0;
		let consistentCount = 0;

		for (const userUsage of usageAggregation) {
			const currentBalanceDoc = await UserBalanceModel.findOne({
				userId: userUsage.userId,
			})
				.setOptions({ skipOwnershipEnforcement: true })
				.lean();

			const currentInputTokens = currentBalanceDoc?.inputTokens ?? 0;
			const currentOutputTokens = currentBalanceDoc?.outputTokens ?? 0;
			const calculatedInputTokens = userUsage.promptTokens;
			const calculatedOutputTokens = userUsage.completionTokens;
			const inputDifference = currentInputTokens - calculatedInputTokens;
			const outputDifference = currentOutputTokens - calculatedOutputTokens;

			if (inputDifference !== 0 || outputDifference !== 0) {
				discrepancies.push({
					userId: userUsage.userId,
					currentInputTokens,
					currentOutputTokens,
					calculatedInputTokens,
					calculatedOutputTokens,
					inputDifference,
					outputDifference,
					usageRecordCount: userUsage.recordCount,
				});

				logger.error(
					{
						userId: userUsage.userId,
						currentInputTokens,
						currentOutputTokens,
						calculatedInputTokens,
						calculatedOutputTokens,
						inputDifference,
						outputDifference,
						usageRecordCount: userUsage.recordCount,
					},
					"Balance inconsistency detected",
				);

				if (!isDryRun) {
					await UserBalanceModel.findOneAndUpdate(
						{ userId: userUsage.userId },
						{
							inputTokens: calculatedInputTokens,
							outputTokens: calculatedOutputTokens,
						},
						{ upsert: true, skipOwnershipEnforcement: true },
					);

					updatedCount++;
					logger.info(
						{
							userId: userUsage.userId,
							newInputTokens: calculatedInputTokens,
							newOutputTokens: calculatedOutputTokens,
						},
						"Balance updated",
					);
				} else {
					logger.info(
						{
							userId: userUsage.userId,
							wouldUpdateInputTo: calculatedInputTokens,
							wouldUpdateOutputTo: calculatedOutputTokens,
						},
						"[DRY RUN] Would update balance",
					);
				}
			} else {
				consistentCount++;
			}
		}

		const usersWithBalanceButNoUsage = await UserBalanceModel.find({
			userId: { $nin: usageAggregation.map((u) => u.userId) },
			$or: [{ inputTokens: { $ne: 0 } }, { outputTokens: { $ne: 0 } }],
		})
			.setOptions({ skipOwnershipEnforcement: true })
			.lean();

		for (const userBalance of usersWithBalanceButNoUsage) {
			discrepancies.push({
				userId: userBalance.userId,
				currentInputTokens: userBalance.inputTokens,
				currentOutputTokens: userBalance.outputTokens,
				calculatedInputTokens: 0,
				calculatedOutputTokens: 0,
				inputDifference: userBalance.inputTokens,
				outputDifference: userBalance.outputTokens,
				usageRecordCount: 0,
			});

			logger.error(
				{
					userId: userBalance.userId,
					currentInputTokens: userBalance.inputTokens,
					currentOutputTokens: userBalance.outputTokens,
					calculatedInputTokens: 0,
					calculatedOutputTokens: 0,
				},
				"User has balance but no usage records",
			);

			if (!isDryRun) {
				await UserBalanceModel.findOneAndUpdate(
					{ userId: userBalance.userId },
					{ inputTokens: 0, outputTokens: 0 },
					{ skipOwnershipEnforcement: true },
				);

				updatedCount++;
				logger.info(
					{ userId: userBalance.userId, newInputTokens: 0, newOutputTokens: 0 },
					"Balance reset to 0",
				);
			} else {
				logger.info(
					{
						userId: userBalance.userId,
						wouldUpdateInputTo: 0,
						wouldUpdateOutputTo: 0,
					},
					"[DRY RUN] Would reset balance to 0",
				);
			}
		}

		logger.info(
			{
				totalUsers: usageAggregation.length,
				inconsistencies: discrepancies.length,
				updated: updatedCount,
				consistent: consistentCount,
				dryRun: isDryRun,
			},
			isDryRun
				? "Balance recalculation completed (DRY RUN - no changes made)"
				: "Balance recalculation completed",
		);

		if (discrepancies.length > 0) {
			logger.info("Summary of discrepancies:");
			for (const disc of discrepancies) {
				logger.info(`  User ${disc.userId}:`);
				logger.info(
					`    Input: ${disc.currentInputTokens} -> ${disc.calculatedInputTokens} (diff: ${disc.inputDifference})`,
				);
				logger.info(
					`    Output: ${disc.currentOutputTokens} -> ${disc.calculatedOutputTokens} (diff: ${disc.outputDifference})`,
				);
				logger.info(`    Records: ${disc.usageRecordCount}`);
			}
		}

		await stopMongoClient();
	} catch (error) {
		logger.error(
			{
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
			"Failed to recalculate balances",
		);
		console.error("Full error:", error);
		process.exit(1);
	}
}

recalculateBalances();
