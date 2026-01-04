import { model, Schema } from "mongoose";

import { createLogger } from "@/app/logger.js";
import { applyOwnershipEnforcement } from "@/app/middleware/mongoOwnershipEnforcement.middleware.js";

import {
	type TUserBalance,
	USER_BALANCE_MODEL_NAME,
	type UserBalanceMethods,
	type UserBalanceModelWithStatics,
} from "./userBalance.types.js";

const logger = createLogger("userBalance.model");

export type UserBalanceModel = UserBalanceModelWithStatics;

const userBalanceSchema = new Schema<
	TUserBalance,
	UserBalanceModel,
	UserBalanceMethods
>(
	{
		userId: {
			type: String,
			required: true,
			unique: true,
			index: true,
			immutable: true,
		},
		inputTokens: {
			type: Number,
			required: true,
			default: 0,
		},
		outputTokens: {
			type: Number,
			required: true,
			default: 0,
		},
	},
	{ timestamps: true, collection: USER_BALANCE_MODEL_NAME },
);

userBalanceSchema.statics.updateBalance = async function (
	this: UserBalanceModelWithStatics,
	userId: string,
	promptTokensDelta: number,
	completionTokensDelta: number,
	session?: import("mongoose").ClientSession,
) {
	const result = await this.findOneAndUpdate(
		{ userId },
		{
			$inc: {
				inputTokens: promptTokensDelta,
				outputTokens: completionTokensDelta,
			},
		},
		{
			upsert: true,
			new: true,
			userId,
			...(session ? { session } : {}),
		},
	);

	if (!result) {
		throw new Error(`Failed to update balance for user ${userId}`);
	}

	logger.debug(
		{
			userId,
			promptTokensDelta,
			completionTokensDelta,
			newInputTokens: result.inputTokens,
			newOutputTokens: result.outputTokens,
		},
		"User balance updated",
	);

	return result;
};

userBalanceSchema.statics.getBalance = async function (
	this: UserBalanceModelWithStatics,
	userId: string,
) {
	const doc = await this.findOne({ userId }).setOptions({ userId }).lean();
	if (!doc) {
		return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
	}
	return {
		inputTokens: doc.inputTokens,
		outputTokens: doc.outputTokens,
		totalTokens: doc.inputTokens + doc.outputTokens,
	};
};

applyOwnershipEnforcement(userBalanceSchema);

export type { UserBalanceDocument } from "./userBalance.types.js";

export const UserBalanceModel = model<TUserBalance, UserBalanceModel>(
	USER_BALANCE_MODEL_NAME,
	userBalanceSchema,
);
