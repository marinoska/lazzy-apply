import type { Document, Model } from "mongoose";

export const USER_BALANCE_MODEL_NAME = "user_balances" as const;

export type TUserBalance = {
	userId: string;
	creditBalance: number;
	createdAt: Date;
	updatedAt: Date;
};

export type UserBalanceMethods = Record<string, never>;

export type UserBalanceStatics = {
	updateBalance(
		this: UserBalanceModelWithStatics,
		userId: string,
		creditsDelta: number,
		session?: import("mongoose").ClientSession,
	): Promise<UserBalanceDocument>;
	getBalance(
		this: UserBalanceModelWithStatics,
		userId: string,
	): Promise<{
		creditBalance: number;
	}>;
};

export type UserBalanceDocument = Document & TUserBalance & UserBalanceMethods;

export type UserBalanceModelBase = Model<
	TUserBalance,
	Record<string, never>,
	UserBalanceMethods
>;

export type UserBalanceModelWithStatics = UserBalanceModelBase &
	UserBalanceStatics;
