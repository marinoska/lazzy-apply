import { model, Schema } from "mongoose";

import {
	type TUsage,
	USAGE_MODEL_NAME,
	USAGE_REFERENCE_TABLES,
	USAGE_TYPES,
	type UsageMethods,
	type UsageModelWithStatics,
	type UsageType,
} from "./usage.types.js";

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

// Compound index for efficient lookups
usageSchema.index({ reference: 1, type: 1 });

// Static methods
usageSchema.statics.createUsage = async function (
	this: UsageModelWithStatics,
	params,
) {
	const result = await this.create(params);
	return result;
};

usageSchema.statics.findByReference = async function (
	this: UsageModelWithStatics,
	reference: Schema.Types.ObjectId,
	type: UsageType,
) {
	return this.findOne({ reference, type });
};

usageSchema.statics.findByType = async function (
	this: UsageModelWithStatics,
	type: UsageType,
) {
	return this.find({ type }).lean();
};

export type { UsageDocument } from "./usage.types.js";

export const UsageModel = model<TUsage, UsageModel>(
	USAGE_MODEL_NAME,
	usageSchema,
);
