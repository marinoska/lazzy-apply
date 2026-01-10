import { createLogger } from "@/app/logger.js";
import { CvWindowBalanceModel } from "./model/cvWindowBalance.model.js";
import type { CreditsType, UsageType } from "./model/usage.types.js";

const logger = createLogger("cvWindowBalanceTracker");

export class CvWindowBalanceTracker {
	async trackCvProcessing(
		userId: string,
		usageType: UsageType | CreditsType,
	): Promise<void> {
		if (usageType !== "cv_data_extraction") {
			return;
		}

		try {
			await CvWindowBalanceModel.incrementUsage(userId);
			logger.debug({ userId }, "CV window balance incremented");
		} catch (error) {
			logger.error({ userId, error }, "Failed to increment CV window balance");
			throw error;
		}
	}

	async checkLimit(
		userId: string,
	): Promise<{ allowed: boolean; remaining: number }> {
		return CvWindowBalanceModel.checkLimit(userId);
	}
}

export const cvWindowBalanceTracker = new CvWindowBalanceTracker();
