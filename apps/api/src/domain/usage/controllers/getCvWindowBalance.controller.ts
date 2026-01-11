import type { Request, Response } from "express";
import { createLogger } from "@/app/logger.js";
import { CvWindowBalanceModel } from "../model/cvWindowBalance.model.js";

const logger = createLogger("getCvWindowBalance.controller");

export async function getCvWindowBalanceController(
	req: Request,
	res: Response,
): Promise<void> {
	try {
		const userId = req.userId;

		if (!userId) {
			res.status(401).json({ error: "Unauthorized" });
			return;
		}

		const result = await CvWindowBalanceModel.checkLimit(userId);
		const balance = await CvWindowBalanceModel.findOne({ userId }).setOptions({
			userId,
		});

		if (!balance) {
			res.json({
				allowed: result.allowed,
				remaining: result.remaining,
				used: 0,
				limit: CV_PROCESSING_LIMIT,
				windowStartAt: null,
				resetsIn: null,
			});
			return;
		}

		const now = new Date();
		const windowEnd = new Date(balance.windowStartAt);
		windowEnd.setHours(windowEnd.getHours() + 24);
		const resetsInMs = Math.max(0, windowEnd.getTime() - now.getTime());
		const resetsInHours = Math.ceil(resetsInMs / (1000 * 60 * 60));

		res.json({
			allowed: result.allowed,
			remaining: result.remaining,
			used: balance.used,
			limit: balance.limit,
			windowStartAt: balance.windowStartAt,
			resetsIn: resetsInHours,
		});

		logger.debug({ userId, result }, "CV window balance retrieved");
	} catch (error) {
		logger.error({ error }, "Failed to get CV window balance");
		res.status(500).json({ error: "Failed to get CV window balance" });
	}
}
