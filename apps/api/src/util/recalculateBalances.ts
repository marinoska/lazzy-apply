import { createLogger } from "@/app/logger.js";
import { connectToMongo, stopMongoClient } from "@/app/mongo.js";
import { UsageModel } from "@/domain/usage/model/usage.model.js";
import { UserBalanceModel } from "@/domain/usage/model/userBalance.model.js";

const logger = createLogger("recalculate-balances");

const isDryRun = process.argv.includes("--dry-run");

interface UserUsageSummary {
	userId: string;
	totalCredits: number;
	recordCount: number;
}

interface BalanceDiscrepancy {
	userId: string;
	currentCreditBalance: number;
	calculatedCreditBalance: number;
	creditDifference: number;
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
					totalCredits: { $sum: "$creditsDelta" },
					recordCount: { $count: {} },
				},
			},
			{
				$project: {
					_id: 0,
					userId: "$_id",
					totalCredits: 1,
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

			const currentCreditBalance = currentBalanceDoc?.creditBalance ?? 0;
			const calculatedCreditBalance = userUsage.totalCredits;
			const creditDifference = currentCreditBalance - calculatedCreditBalance;

			if (creditDifference !== 0) {
				discrepancies.push({
					userId: userUsage.userId,
					currentCreditBalance,
					calculatedCreditBalance,
					creditDifference,
					usageRecordCount: userUsage.recordCount,
				});

				logger.error(
					{
						userId: userUsage.userId,
						currentCreditBalance,
						calculatedCreditBalance,
						creditDifference,
						usageRecordCount: userUsage.recordCount,
					},
					"Balance inconsistency detected",
				);

				if (!isDryRun) {
					await UserBalanceModel.findOneAndUpdate(
						{ userId: userUsage.userId },
						{
							creditBalance: calculatedCreditBalance,
						},
						{ upsert: true, skipOwnershipEnforcement: true },
					);

					updatedCount++;
					logger.info(
						{
							userId: userUsage.userId,
							newCreditBalance: calculatedCreditBalance,
						},
						"Balance updated",
					);
				} else {
					logger.info(
						{
							userId: userUsage.userId,
							wouldUpdateCreditBalanceTo: calculatedCreditBalance,
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
			creditBalance: { $ne: 0 },
		})
			.setOptions({ skipOwnershipEnforcement: true })
			.lean();

		for (const userBalance of usersWithBalanceButNoUsage) {
			discrepancies.push({
				userId: userBalance.userId,
				currentCreditBalance: userBalance.creditBalance,
				calculatedCreditBalance: 0,
				creditDifference: userBalance.creditBalance,
				usageRecordCount: 0,
			});

			logger.error(
				{
					userId: userBalance.userId,
					currentCreditBalance: userBalance.creditBalance,
					calculatedCreditBalance: 0,
				},
				"User has balance but no usage records",
			);

			if (!isDryRun) {
				await UserBalanceModel.findOneAndUpdate(
					{ userId: userBalance.userId },
					{ creditBalance: 0 },
					{ skipOwnershipEnforcement: true },
				);

				updatedCount++;
				logger.info(
					{ userId: userBalance.userId, newCreditBalance: 0 },
					"Balance reset to 0",
				);
			} else {
				logger.info(
					{
						userId: userBalance.userId,
						wouldUpdateCreditBalanceTo: 0,
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
					`    Credit Balance: ${disc.currentCreditBalance} -> ${disc.calculatedCreditBalance} (diff: ${disc.creditDifference})`,
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
