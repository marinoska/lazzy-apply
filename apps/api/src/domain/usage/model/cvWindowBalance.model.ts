import { addDays, isWithinInterval, subDays } from "date-fns";
import { model, Schema } from "mongoose";

import { createLogger } from "@/app/logger.js";
import { applyOwnershipEnforcement } from "@/app/middleware/mongoOwnershipEnforcement.middleware.js";

import {
	CV_PROCESSING_LIMIT,
	CV_WINDOW_BALANCE_MODEL_NAME,
	type CvWindowBalanceDocument,
	type CvWindowBalanceMethods,
	type CvWindowBalanceModelWithStatics,
	type TCvWindowBalance,
} from "./cvWindowBalance.types.js";

const logger = createLogger("cvWindowBalance.model");

export type CvWindowBalanceModel = CvWindowBalanceModelWithStatics;

const cvWindowBalanceSchema = new Schema<
	TCvWindowBalance,
	CvWindowBalanceModel,
	CvWindowBalanceMethods
>(
	{
		userId: {
			type: String,
			required: true,
			unique: true,
			index: true,
			immutable: true,
		},
		windowStartAt: {
			type: Date,
			required: true,
		},
		used: {
			type: Number,
			required: true,
			default: 0,
			min: 0,
		},
		limit: {
			type: Number,
			required: true,
			default: CV_PROCESSING_LIMIT,
			min: 1,
		},
	},
	{ timestamps: true, collection: CV_WINDOW_BALANCE_MODEL_NAME },
);

cvWindowBalanceSchema.statics.getOrCreate = async function (
	this: CvWindowBalanceModelWithStatics,
	userId: string,
) {
	let balance = await this.findOne({ userId }).setOptions({ userId });

	if (!balance) {
		balance = await this.create({
			userId,
			windowStartAt: new Date(),
			used: 0,
			limit: CV_PROCESSING_LIMIT,
		});
		logger.debug({ userId }, "Created new CV window balance");
	} else {
		balance = await this.resetWindowIfExpired(balance);
	}

	return balance;
};

cvWindowBalanceSchema.statics.resetWindowIfExpired = async function (
	this: CvWindowBalanceModelWithStatics,
	balance: CvWindowBalanceDocument,
) {
	const now = new Date();
	const windowEnd = addDays(balance.windowStartAt, 1);

	if (now >= windowEnd) {
		const oldWindowStart = balance.windowStartAt;
		const newWindowStartAt = calculateNewWindowStart(oldWindowStart, now);

		balance.windowStartAt = newWindowStartAt;
		balance.used = 0;
		await balance.save();

		logger.debug(
			{
				userId: balance.userId,
				oldWindowStart,
				newWindowStartAt,
			},
			"Reset CV window balance",
		);
	}

	return balance;
};

cvWindowBalanceSchema.statics.incrementUsage = async function (
	this: CvWindowBalanceModelWithStatics,
	userId: string,
) {
	const balance = await this.getOrCreate(userId);

	if (balance.used >= balance.limit) {
		logger.error(
			{
				userId,
				limit: balance.limit,
				used: balance.used,
				overuse: balance.used - balance.limit + 1,
			},
			"CV processing limit exceeded - persisting overuse",
		);
	}

	balance.used += 1;
	await balance.save();

	logger.debug(
		{
			userId,
			used: balance.used,
			limit: balance.limit,
		},
		"Incremented CV window usage",
	);

	return balance;
};

cvWindowBalanceSchema.statics.checkLimit = async function (
	this: CvWindowBalanceModelWithStatics,
	userId: string,
) {
	const balance = await this.getOrCreate(userId);
	const remaining = Math.max(0, balance.limit - balance.used);
	const allowed = balance.used < balance.limit;

	return { allowed, remaining };
};

/**
 * Calculates the new window start time while preserving the time-of-day anchor.
 *
 * The window is rolling: it maintains the same HH:MM:SS as the original windowStartAt,
 * but finds the most recent 24h period that contains 'now'.
 *
 * Algorithm:
 * 1. Create a candidate date at today's date with the old window's time-of-day
 * 2. Check if 'now' falls within [candidate, candidate + 24h)
 * 3. If yes, return candidate (window starts today at the anchor time)
 * 4. If no, return candidate - 24h (window started yesterday at the anchor time)
 *
 * Example: If original window started at 2024-01-01 14:37:25 and now is 2024-01-05 16:00:00,
 * the new window will start at 2024-01-05 14:37:25 (same time, most recent day containing now).
 */
function calculateNewWindowStart(oldWindowStart: Date, now: Date): Date {
	const candidateDate = new Date(now);
	candidateDate.setUTCHours(
		oldWindowStart.getUTCHours(),
		oldWindowStart.getUTCMinutes(),
		oldWindowStart.getUTCSeconds(),
		oldWindowStart.getUTCMilliseconds(),
	);

	const windowEnd = addDays(candidateDate, 1);

	if (isWithinInterval(now, { start: candidateDate, end: windowEnd })) {
		return candidateDate;
	}

	return subDays(candidateDate, 1);
}

applyOwnershipEnforcement(cvWindowBalanceSchema);

export type { CvWindowBalanceDocument } from "./cvWindowBalance.types.js";

export const CvWindowBalanceModel = model<
	TCvWindowBalance,
	CvWindowBalanceModel
>(CV_WINDOW_BALANCE_MODEL_NAME, cvWindowBalanceSchema);
