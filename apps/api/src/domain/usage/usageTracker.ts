import type { TokenUsage } from "@lazyapply/types";
import type { ClientSession, Types } from "mongoose";
import { createLogger } from "@/app/logger.js";
import { UsageModel } from "./model/usage.model.js";
import type { UsageReferenceTable, UsageType } from "./model/usage.types.js";
import { UserBalanceModel } from "./model/userBalance.model.js";

const logger = createLogger("usage.tracker");

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

export interface UsageTrackerConfig {
	referenceTable: UsageReferenceTable;
}

/**
 * Universal usage tracker for tracking token usage across different operations.
 * Can be used for autofill, CV data extraction, and other LLM-based operations.
 */
export class UsageTracker {
	private referenceId?: Types.ObjectId;
	private autofillId?: Types.ObjectId;
	private readonly usageEntries: Map<UsageType, TokenUsage | null | undefined> =
		new Map();

	constructor(
		private readonly userId: string,
		private readonly config: UsageTrackerConfig,
	) {}

	setReference(referenceId: Types.ObjectId): void {
		this.referenceId = referenceId;
	}

	setAutofillId(autofillId: Types.ObjectId): void {
		this.autofillId = autofillId;
	}

	setUsage(type: UsageType, usage: TokenUsage | null | undefined): void {
		this.usageEntries.set(type, usage);
	}

	getUsage(type: UsageType): TokenUsage | null | undefined {
		return this.usageEntries.get(type);
	}

	async persistAllUsage(session: ClientSession): Promise<void> {
		if (!this.referenceId) {
			throw new Error("Reference must be set before tracking usage");
		}

		const persistPromises: Promise<void>[] = [];

		for (const [type, usage] of this.usageEntries) {
			persistPromises.push(this.persistUsage(usage, type, session));
		}

		await Promise.all(persistPromises);
	}

	private async persistUsage(
		usage: TokenUsage | null | undefined,
		type: UsageType,
		session: ClientSession,
	): Promise<void> {
		if (!usage || usage.totalTokens === 0) {
			return;
		}

		if (!this.referenceId) {
			throw new Error("Reference must be set before tracking usage");
		}

		await UsageModel.create(
			[
				{
					referenceTable: this.config.referenceTable,
					reference: this.referenceId,
					userId: this.userId,
					...(this.autofillId && { autofillId: this.autofillId }),
					type,
					promptTokens: usage.promptTokens,
					completionTokens: usage.completionTokens,
					totalTokens: usage.totalTokens,
					inputCost: usage.inputCost ?? 0,
					outputCost: usage.outputCost ?? 0,
					totalCost: usage.totalCost ?? 0,
				},
			],
			session ? { session } : {},
		);

		await UserBalanceModel.updateBalance(
			this.userId,
			usage.promptTokens,
			usage.completionTokens,
			session,
		);

		logger.debug(
			{
				type,
				totalTokens: usage.totalTokens,
				referenceTable: this.config.referenceTable,
			},
			"Usage persisted",
		);
	}
}
