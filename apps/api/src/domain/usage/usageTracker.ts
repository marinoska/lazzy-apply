import type { TokenUsage } from "@lazyapply/types";
import type { Types } from "mongoose";
import { createLogger } from "@/app/logger.js";
import { BaseBalanceTracker } from "./abstractBalanceTracker.js";
import type { UsageData } from "./balanceData.types.js";
import type { UsageType } from "./model/usage.types.js";

const logger = createLogger("UsageTracker");

export function createEmptyUsage(): TokenUsage {
	return {
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
		inputCost: 0,
		outputCost: 0,
		totalCost: 0,
	};
}

export interface UsageEntry {
	usage: TokenUsage | null | undefined;
	type: UsageType;
}

/**
 * Universal usage tracker for tracking token usage across different operations.
 * Can be used for autofill, CV data extraction, and other LLM-based operations.
 * Tracks negative credits (spending) and token consumption.
 */
export class UsageTracker extends BaseBalanceTracker {
	private autofillId?: Types.ObjectId;
	private readonly usageEntries: UsageData[] = [];

	setAutofillId(autofillId: Types.ObjectId): void {
		this.autofillId = autofillId;
	}

	setUsage(type: UsageType, usage: TokenUsage): void {
		if (usage.totalTokens === 0) {
			logger.info({ type, usage }, "Skipping usage tracking for zero tokens");
			return;
		}

		const creditsDelta = this.calculateCreditsFromUsage(usage);

		this.usageEntries.push({
			type,
			creditsDelta: -creditsDelta,
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.totalTokens,
			inputCost: usage.inputCost,
			outputCost: usage.outputCost,
			totalCost: usage.totalCost,
		});
	}

	protected getCreditsDelta(): UsageData[] {
		if (!this.autofillId) {
			return this.usageEntries;
		}

		return this.usageEntries.map((entry) => ({
			...entry,
			autofillId: this.autofillId,
		}));
	}
}
