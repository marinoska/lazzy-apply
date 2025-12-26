import type { AutofillResponseData, TokenUsage } from "@lazyapply/types";
import type { Types } from "mongoose";
import { createLogger } from "@/app/logger.js";
import {
	AUTOFILL_MODEL_NAME,
	type AutofillDocument,
} from "@/domain/autofill/index.js";
import { UsageModel } from "@/domain/usage/index.js";

const _logger = createLogger("autofill.service");

function createEmptyUsage(): TokenUsage {
	return {
		promptTokens: 0,
		completionTokens: 0,
		totalTokens: 0,
		inputCost: 0,
		outputCost: 0,
		totalCost: 0,
	};
}

export interface AutofillPersistParams {
	formId: Types.ObjectId;
	uploadId: string;
	cvDataId: string;
	userId: string;
	response: AutofillResponseData;
	fieldHashToIdMap: Map<string, Types.ObjectId>;
	jdRawText: string;
	formContext: string;
}

export interface UsageTracking {
	classification: TokenUsage;
	jdFormMatch: TokenUsage | null;
	inference: TokenUsage | undefined;
}

export class AutofillUsageTracker {
	private autofillId?: Types.ObjectId;

	constructor(
		private readonly userId: string,
		private readonly usageTracking: UsageTracking = {
			classification: createEmptyUsage(),
			jdFormMatch: null,
			inference: undefined,
		},
	) {}

	setAutofill(autofill: AutofillDocument) {
		this.autofillId = autofill._id;
	}

	setClassificationUsage(usage: TokenUsage) {
		this.usageTracking.classification = usage;
	}

	setJdFormMatchUsage(usage: TokenUsage | null) {
		this.usageTracking.jdFormMatch = usage;
	}

	setInferenceUsage(usage: TokenUsage | undefined) {
		this.usageTracking.inference = usage;
	}

	async persistAllUsage() {
		if (!this.autofillId) {
			throw new Error("Autofill must be persisted before tracking usage");
		}

		await Promise.all([
			this.persistUsage(
				this.usageTracking.classification,
				"form_fields_classification",
			),
			this.persistUsage(this.usageTracking.jdFormMatch, "jd_form_match"),
			this.persistUsage(this.usageTracking.inference, "form_fields_inference"),
		]);
	}

	private async persistUsage(
		usage: TokenUsage | null | undefined,
		type:
			| "form_fields_classification"
			| "jd_form_match"
			| "form_fields_inference",
	) {
		if (!usage || usage.totalTokens === 0) {
			return;
		}

		if (!this.autofillId) {
			throw new Error("Autofill must be persisted before tracking usage");
		}

		await UsageModel.create({
			referenceTable: AUTOFILL_MODEL_NAME,
			reference: this.autofillId,
			userId: this.userId,
			type,
			promptTokens: usage.promptTokens,
			completionTokens: usage.completionTokens,
			totalTokens: usage.totalTokens,
			inputCost: usage.inputCost ?? 0,
			outputCost: usage.outputCost ?? 0,
			totalCost: usage.totalCost ?? 0,
		});
	}
}
