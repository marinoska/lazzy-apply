import type { Document, Model } from "mongoose";

export const CV_WINDOW_BALANCE_MODEL_NAME = "cv_window_balance" as const;

export const CV_PROCESSING_LIMIT = 10 as const;

export type TCvWindowBalance = {
	userId: string;
	windowStartAt: Date;
	used: number;
	limit: number;
	createdAt: Date;
	updatedAt: Date;
};

export type CvWindowBalanceMethods = object;

export type CvWindowBalanceStatics = {
	getOrCreate(
		this: CvWindowBalanceModelWithStatics,
		userId: string,
	): Promise<CvWindowBalanceDocument>;
	incrementUsage(
		this: CvWindowBalanceModelWithStatics,
		userId: string,
	): Promise<CvWindowBalanceDocument>;
	checkLimit(
		this: CvWindowBalanceModelWithStatics,
		userId: string,
	): Promise<{ allowed: boolean; remaining: number }>;
	resetWindowIfExpired<T extends CvWindowBalanceDocument>(
		this: CvWindowBalanceModelWithStatics,
		balance: T,
	): Promise<T>;
};

export type CvWindowBalanceDocument = Document &
	TCvWindowBalance &
	CvWindowBalanceMethods;

export type CvWindowBalanceModelBase = Model<
	TCvWindowBalance,
	Record<string, never>,
	CvWindowBalanceMethods
>;

export type CvWindowBalanceModelWithStatics = CvWindowBalanceModelBase &
	CvWindowBalanceStatics;
