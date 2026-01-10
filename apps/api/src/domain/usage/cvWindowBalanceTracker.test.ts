import { beforeEach, describe, expect, it } from "vitest";
import { CvWindowBalanceTracker } from "./cvWindowBalanceTracker.js";
import { CvWindowBalanceModel } from "./model/cvWindowBalance.model.js";

describe("CvWindowBalanceTracker", () => {
	let tracker: CvWindowBalanceTracker;

	beforeEach(async () => {
		await CvWindowBalanceModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		tracker = new CvWindowBalanceTracker();
	});

	describe("trackCvProcessing", () => {
		it("should increment usage for cv_data_extraction type", async () => {
			const userId = "test-user-1";

			await tracker.trackCvProcessing(userId, "cv_data_extraction");

			const balance = await CvWindowBalanceModel.findOne({ userId }).setOptions(
				{ userId },
			);
			expect(balance).toBeDefined();
			expect(balance?.used).toBe(1);
		});

		it("should not increment usage for non-cv_data_extraction types", async () => {
			const userId = "test-user-2";

			await tracker.trackCvProcessing(userId, "form_fields_classification");

			const balance = await CvWindowBalanceModel.findOne({ userId }).setOptions(
				{ userId },
			);
			expect(balance).toBeNull();
		});

		it("should increment usage multiple times", async () => {
			const userId = "test-user-3";

			await tracker.trackCvProcessing(userId, "cv_data_extraction");
			await tracker.trackCvProcessing(userId, "cv_data_extraction");
			await tracker.trackCvProcessing(userId, "cv_data_extraction");

			const balance = await CvWindowBalanceModel.findOne({ userId }).setOptions(
				{ userId },
			);
			expect(balance?.used).toBe(3);
		});

		it("should persist overuse when limit is reached", async () => {
			const userId = "test-user-4";

			await CvWindowBalanceModel.create({
				userId,
				windowStartAt: new Date(),
				used: 10,
				limit: 10,
			});

			await tracker.trackCvProcessing(userId, "cv_data_extraction");

			const balance = await CvWindowBalanceModel.findOne({ userId }).setOptions(
				{ userId },
			);
			expect(balance?.used).toBe(11);
		});
	});

	describe("checkLimit", () => {
		it("should return allowed true for new user", async () => {
			const userId = "test-user-5";

			const result = await tracker.checkLimit(userId);

			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(10);
		});

		it("should return correct remaining after usage", async () => {
			const userId = "test-user-6";

			await tracker.trackCvProcessing(userId, "cv_data_extraction");
			await tracker.trackCvProcessing(userId, "cv_data_extraction");

			const result = await tracker.checkLimit(userId);

			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(8);
		});

		it("should return allowed false when limit is reached", async () => {
			const userId = "test-user-7";

			await CvWindowBalanceModel.create({
				userId,
				windowStartAt: new Date(),
				used: 10,
				limit: 10,
			});

			const result = await tracker.checkLimit(userId);

			expect(result.allowed).toBe(false);
			expect(result.remaining).toBe(0);
		});
	});
});
