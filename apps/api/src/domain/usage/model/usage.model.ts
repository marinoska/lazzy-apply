import { model, Schema } from "mongoose";

import { createLogger } from "@/app/logger.js";
import { applyOwnershipEnforcement } from "@/app/middleware/mongoOwnershipEnforcement.middleware.js";
import { isDuplicateKeyError } from "@/util/mongoErrors.js";

import {
	CREDITS_TYPES,
	type TUsage,
	USAGE_MODEL_NAME,
	USAGE_REFERENCE_TABLES,
	USAGE_TYPES,
	type UsageMethods,
	type UsageModelWithStatics,
	type UsageType,
} from "./usage.types.js";

const logger = createLogger("usage.model");

export type UsageModel = UsageModelWithStatics;

const usageSchema = new Schema<TUsage, UsageModel, UsageMethods>(
	{
		referenceTable: {
			type: String,
			required: true,
			enum: USAGE_REFERENCE_TABLES,
			immutable: true,
		},
		reference: {
			type: Schema.Types.ObjectId,
			refPath: "referenceTable",
			required: true,
			index: true,
			immutable: true,
		},
		userId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		autofillId: {
			type: Schema.Types.ObjectId,
			ref: "autofill",
			required: false,
			immutable: true,
		},
		type: {
			type: String,
			required: true,
			enum: [...USAGE_TYPES, ...CREDITS_TYPES],
			index: true,
			immutable: true,
		},
		creditsDelta: {
			type: Number,
			required: true,
			immutable: true,
		},
		promptTokens: {
			type: Number,
			required: true,
			default: 0,
			immutable: true,
		},
		completionTokens: {
			type: Number,
			required: true,
			default: 0,
			immutable: true,
		},
		totalTokens: {
			type: Number,
			required: true,
			default: 0,
			immutable: true,
		},
		inputCost: {
			type: Number,
			required: true,
			default: 0,
			immutable: true,
		},
		outputCost: {
			type: Number,
			required: true,
			default: 0,
			immutable: true,
		},
		totalCost: {
			type: Number,
			required: true,
			default: 0,
			immutable: true,
		},
	},
	{ timestamps: true, collection: USAGE_MODEL_NAME },
);

// Compound unique index - each reference can only have one usage record per type
usageSchema.index({ userId: 1, reference: 1, type: 1 }, { unique: true });

// Compound index for querying by userId and autofillId
usageSchema.index({ userId: 1, autofillId: 1 });

// Static methods
/**
 * @deprecated Use UsageTracker instead to ensure user balance is updated.
 * Direct usage creation does not update user balances.
 * This method should only be used internally by UsageTracker.
 */
usageSchema.statics.createUsage = async function (
	this: UsageModelWithStatics,
	params,
) {
	try {
		return await this.create(params);
	} catch (error) {
		if (isDuplicateKeyError(error)) {
			logger.error(
				{ reference: params.reference, type: params.type },
				"Duplicate usage record detected, returning existing",
			);
			const existing = await this.findByReference(
				params.reference,
				params.type,
				params.userId,
			);
			if (existing) return existing;
		}
		throw error;
	}
};

usageSchema.statics.findByReference = async function (
	this: UsageModelWithStatics,
	reference: Schema.Types.ObjectId,
	type: UsageType,
	userId?: string,
) {
	const query = this.findOne({ reference, type });
	if (userId) {
		query.setOptions({ userId });
	}
	return query;
};

usageSchema.statics.findByType = async function (
	this: UsageModelWithStatics,
	type: UsageType,
) {
	return this.find({ type }).lean();
};

applyOwnershipEnforcement(usageSchema);

export type { UsageDocument } from "./usage.types.js";

export const UsageModel = model<TUsage, UsageModel>(
	USAGE_MODEL_NAME,
	usageSchema,
);
