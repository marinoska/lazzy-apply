import type { TokenUsage } from "@lazyapply/types";
import type { AutofillDocument } from "@/domain/autofill/index.js";
import { UsageTracker } from "@/domain/usage/index.js";
import type { ClientSession } from "mongoose";

export interface UsageTracking {
	classification: TokenUsage;
	jdFormMatch: TokenUsage | null;
	inference: TokenUsage | undefined;
}

/**
 * Autofill-specific usage tracker that wraps the universal UsageTracker.
 * Provides convenience methods for autofill-specific usage types.
 */
export class AutofillUsageTracker {
	private readonly tracker: UsageTracker;

	constructor(userId: string) {
		this.tracker = new UsageTracker(userId, { referenceTable: "autofill" });
	}

	setAutofill(autofill: AutofillDocument): void {
		this.tracker.setReference(autofill._id);
	}

	setClassificationUsage(usage: TokenUsage): void {
		this.tracker.setUsage("form_fields_classification", usage);
	}

	setJdFormMatchUsage(usage: TokenUsage | null): void {
		this.tracker.setUsage("jd_form_match", usage);
	}

	setInferenceUsage(usage: TokenUsage | undefined): void {
		this.tracker.setUsage("form_fields_inference", usage);
	}

	async persistAllUsage(session: ClientSession): Promise<void> {
		await this.tracker.persistAllUsage(session);
	}
}
