import type { TokenUsage } from "@lazyapply/types";
import type { ClientSession } from "mongoose";
import { getEnv } from "@/app/env.js";
import type { AutofillDocument } from "@/domain/autofill/index.js";
import { UsageTracker } from "@/domain/usage/index.js";

export interface UsageTracking {
	classification: TokenUsage;
	jdFormExtractorRouter: TokenUsage | null;
	jdFormExtractorWriter: TokenUsage | null;
	inference: TokenUsage | undefined;
}

/**
 * Autofill-specific usage tracker that wraps the universal UsageTracker.
 * Provides convenience methods for autofill-specific usage types.
 */
export class AutofillUsageTracker {
	private readonly tracker: UsageTracker;

	constructor(userId: string) {
		this.tracker = new UsageTracker(
			userId,
			{ referenceTable: "autofill" },
			{
				model: getEnv("OPENAI_MODEL"),
				inputPricePer1M: Number(getEnv("OPENAI_MODEL_INPUT_PRICE_PER_1M")),
				outputPricePer1M: Number(getEnv("OPENAI_MODEL_OUTPUT_PRICE_PER_1M")),
			},
		);
	}

	setAutofill(autofill: AutofillDocument): void {
		this.tracker.setReference(autofill._id);
		this.tracker.setAutofillId(autofill._id);
	}

	setClassificationUsage(usage: TokenUsage): void {
		this.tracker.setUsage("form_fields_classification", usage);
	}

	setJdFormExtractorRouterUsage(usage: TokenUsage | null): void {
		if (usage) {
			this.tracker.setUsage("jd_form_extractor:router", usage);
		}
	}

	setJdFormExtractorWriterUsage(usage: TokenUsage | null): void {
		if (usage) {
			this.tracker.setUsage("jd_form_extractor:writer", usage);
		}
	}

	setInferenceUsage(usage: TokenUsage | undefined): void {
		if (usage) {
			this.tracker.setUsage("form_fields_inference", usage);
		}
	}

	async persist(session: ClientSession): Promise<void> {
		await this.tracker.persist(session);
	}

	async persistUsage(session: ClientSession): Promise<void> {
		await this.tracker.persist(session);
	}
}
