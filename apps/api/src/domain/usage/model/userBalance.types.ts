import type { Document, Model } from "mongoose";

export const USER_BALANCE_MODEL_NAME = "user_balances" as const;

export type TUserBalance = {
	userId: string;
	balance: number;
	createdAt: Date;
	updatedAt: Date;
};

export type UserBalanceMethods = Record<string, never>;

export type UserBalanceStatics = {
	updateBalance(
		this: UserBalanceModelWithStatics,
		userId: string,
		delta: number,
		session?: import("mongoose").ClientSession,
	): Promise<UserBalanceDocument>;
	getBalance(
		this: UserBalanceModelWithStatics,
		userId: string,
	): Promise<number>;
};

export type UserBalanceDocument = Document & TUserBalance & UserBalanceMethods;

export type UserBalanceModelBase = Model<
	TUserBalance,
	Record<string, never>,
	UserBalanceMethods
>;

export type UserBalanceModelWithStatics = UserBalanceModelBase &
	UserBalanceStatics;
