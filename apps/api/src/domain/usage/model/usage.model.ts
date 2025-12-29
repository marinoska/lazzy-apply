import { model, Schema } from "mongoose";

import { createLogger } from "@/app/logger.js";
import { applyOwnershipEnforcement } from "@/app/middleware/mongoOwnershipEnforcement.middleware.js";
import { isDuplicateKeyError } from "@/util/mongoErrors.js";

import {
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
		type: {
			type: String,
			required: true,
			enum: USAGE_TYPES,
			index: true,
			immutable: true,
		},
		promptTokens: {
			type: Number,
			required: true,
			immutable: true,
		},
		completionTokens: {
			type: Number,
			required: true,
			immutable: true,
		},
		totalTokens: {
			type: Number,
			required: true,
			immutable: true,
		},
		inputCost: {
			type: Number,
			default: undefined,
			immutable: true,
		},
		outputCost: {
			type: Number,
			default: undefined,
			immutable: true,
		},
		totalCost: {
			type: Number,
			default: undefined,
			immutable: true,
		},
	},
	{ timestamps: true, collection: USAGE_MODEL_NAME },
);

// Compound unique index - each reference can only have one usage record per type
usageSchema.index({ reference: 1, type: 1 }, { unique: true });

// Static methods
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
