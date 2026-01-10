import type { Types } from "mongoose";
import type { CreditsType, UsageType } from "./model/usage.types.js";

export type CreditData = {
	type: CreditsType;
	creditsDelta: number;
};

export type UsageData = {
	type: UsageType;
	creditsDelta: number;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	inputCost: number;
	outputCost: number;
	totalCost: number;
	autofillId?: Types.ObjectId;
};

export type BalanceDelta = CreditData | UsageData;
