import type { TokenUsage } from "@lazyapply/types";
import type { ClientSession, Types } from "mongoose";
import { createLogger } from "@/app/logger.js";
import type { BalanceDelta } from "./balanceData.types.js";
import { UsageModel } from "./model/usage.model.js";
import type { UsageReferenceTable } from "./model/usage.types.js";
import { UserBalanceModel } from "./model/userBalance.model.js";

const logger = createLogger("base.balance.tracker");

export interface BalanceTrackerConfig {
	referenceTable: UsageReferenceTable;
}

export abstract class BaseBalanceTracker {
	protected referenceId?: Types.ObjectId;

	constructor(
		protected readonly userId: string,
		protected readonly config: BalanceTrackerConfig,
	) {}

	setReference(referenceId: Types.ObjectId): void {
		this.referenceId = referenceId;
	}

	protected ensureReferenceSet(): void {
		if (!this.referenceId) {
			throw new Error("Reference must be set before tracking usage");
		}
	}

	protected calculateCreditsFromUsage(usage: TokenUsage): number {
		return usage.totalCost;
	}

	protected abstract getCreditsDelta(): BalanceDelta[];

	async persist(session: ClientSession): Promise<void> {
		this.ensureReferenceSet();

		const balanceDeltaList = this.getCreditsDelta();
		if (balanceDeltaList.length === 0) {
			return;
		}

		for (const delta of balanceDeltaList) {
			const isUsageData = "promptTokens" in delta;

			await UsageModel.create(
				[
					{
						referenceTable: this.config.referenceTable,
						reference: this.referenceId,
						userId: this.userId,
						...(isUsageData &&
							delta.autofillId && { autofillId: delta.autofillId }),
						type: delta.type,
						creditsDelta: delta.creditsDelta,
						promptTokens: isUsageData ? delta.promptTokens : 0,
						completionTokens: isUsageData ? delta.completionTokens : 0,
						totalTokens: isUsageData ? delta.totalTokens : 0,
						inputCost: isUsageData ? delta.inputCost : 0,
						outputCost: isUsageData ? delta.outputCost : 0,
						totalCost: isUsageData ? delta.totalCost : 0,
					},
				],
				{ session },
			);

			await UserBalanceModel.updateBalance(
				this.userId,
				isUsageData ? delta.promptTokens : 0,
				isUsageData ? delta.completionTokens : 0,
				session,
			);

			logger.debug(
				{
					type: delta.type,
					creditsDelta: delta.creditsDelta,
					referenceTable: this.config.referenceTable,
				},
				"Balance delta persisted",
			);
		}
	}
}
