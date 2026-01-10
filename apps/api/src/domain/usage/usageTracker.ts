import type { TokenUsage } from "@lazyapply/types";
import type { Types } from "mongoose";
import { createLogger } from "@/app/logger.js";
import {
	type BalanceTrackerConfig,
	BaseBalanceTracker,
} from "./abstractBalanceTracker.js";
import type { UsageData } from "./balanceData.types.js";
import type { UsageType } from "./model/usage.types.js";

const logger = createLogger("UsageTracker");

export function createEmptyUsage(): TokenUsage {
	return {
		promptTokens: 0,
		completionTokens: 0,
	};
}

export interface UsageEntry {
	usage: TokenUsage | null | undefined;
	type: UsageType;
}

export interface UsageTrackerConfig {
	model: string;
	inputPricePer1M: number;
	outputPricePer1M: number;
}

/**
 * Universal usage tracker for tracking token usage across different operations.
 * Can be used for autofill, CV data extraction, and other LLM-based operations.
 * Tracks negative credits (spending) and token consumption.
 */
export class UsageTracker extends BaseBalanceTracker {
	private autofillId?: Types.ObjectId;
	private readonly usageEntries: UsageData[] = [];
	private readonly model: string;
	private readonly inputPricePer1M: number;
	private readonly outputPricePer1M: number;

	constructor(
		userId: string,
		config: BalanceTrackerConfig,
		usageConfig: UsageTrackerConfig,
	) {
		super(userId, config);
		this.model = usageConfig.model;
		this.inputPricePer1M = usageConfig.inputPricePer1M;
		this.outputPricePer1M = usageConfig.outputPricePer1M;
	}

	setAutofillId(autofillId: Types.ObjectId): void {
		this.autofillId = autofillId;
	}

	private calculateCosts(usage: TokenUsage): {
		inputCost: number;
		outputCost: number;
		totalCost: number;
	} {
		const inputCost = (usage.promptTokens / 1_000_000) * this.inputPricePer1M;
		const outputCost =
			(usage.completionTokens / 1_000_000) * this.outputPricePer1M;
		const totalCost = inputCost + outputCost;

		return { inputCost, outputCost, totalCost };
	}

	setUsage(type: UsageType, usage: TokenUsage): void {
		if (usage.promptTokens === 0 && usage.completionTokens === 0) {
			logger.info({ type, usage }, "Skipping usage tracking for zero tokens");
			return;
		}

		const { inputCost, outputCost, totalCost } = this.calculateCosts(usage);
		const creditsDelta = this.calculateCreditsFromUsage(totalCost);

		this.usageEntries.push({
			type,
			creditsDelta: -creditsDelta,
			model: this.model,
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			inputCost,
			outputCost,
			totalCost,
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
