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
		balance: {
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
	delta: number,
	session?: import("mongoose").ClientSession,
) {
	const result = await this.findOneAndUpdate(
		{ userId },
		{ $inc: { balance: delta } },
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
		{ userId, delta, newBalance: result.balance },
		"User balance updated",
	);

	return result;
};

userBalanceSchema.statics.getBalance = async function (
	this: UserBalanceModelWithStatics,
	userId: string,
) {
	const doc = await this.findOne({ userId }).setOptions({ userId }).lean();
	return doc?.balance ?? 0;
};

applyOwnershipEnforcement(userBalanceSchema);

export type { UserBalanceDocument } from "./userBalance.types.js";

export const UserBalanceModel = model<TUserBalance, UserBalanceModel>(
	USER_BALANCE_MODEL_NAME,
	userBalanceSchema,
);
