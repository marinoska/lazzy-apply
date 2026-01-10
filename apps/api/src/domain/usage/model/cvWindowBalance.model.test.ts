import { beforeEach, describe, expect, it, vi } from "vitest";
import { CvWindowBalanceModel } from "./cvWindowBalance.model.js";
import { CV_PROCESSING_LIMIT } from "./cvWindowBalance.types.js";

describe("CvWindowBalanceModel", () => {
	beforeEach(async () => {
		await CvWindowBalanceModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		vi.useRealTimers();
	});

	describe("getOrCreate", () => {
		it("should create a new balance record for new user", async () => {
			const userId = "test-user-1";
			const before = new Date();

			const result = await CvWindowBalanceModel.getOrCreate(userId);

			expect(result.userId).toBe(userId);
			expect(result.used).toBe(0);
			expect(result.limit).toBe(CV_PROCESSING_LIMIT);
			expect(result.windowStartAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(result.windowStartAt.getTime()).toBeLessThanOrEqual(Date.now());
		});

		it("should return existing balance record", async () => {
			const userId = "test-user-2";

			const first = await CvWindowBalanceModel.getOrCreate(userId);
			const second = await CvWindowBalanceModel.getOrCreate(userId);

			expect(first._id.toString()).toBe(second._id.toString());
			expect(second.used).toBe(0);
		});

		it("should reset window if expired", async () => {
			const userId = "test-user-3";
			const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

			await CvWindowBalanceModel.create({
				userId,
				windowStartAt: pastDate,
				used: 5,
				limit: CV_PROCESSING_LIMIT,
			});

			const result = await CvWindowBalanceModel.getOrCreate(userId);

			expect(result.used).toBe(0);
			expect(result.windowStartAt.getTime()).toBeGreaterThan(
				pastDate.getTime(),
			);
		});
	});

	describe("resetWindowIfExpired", () => {
		it("should not reset if window is still active", async () => {
			const userId = "test-user-4";
			const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000);

			const balance = await CvWindowBalanceModel.create({
				userId,
				windowStartAt: recentDate,
				used: 3,
				limit: CV_PROCESSING_LIMIT,
			});

			const result = await CvWindowBalanceModel.resetWindowIfExpired(balance);

			expect(result.used).toBe(3);
			expect(result.windowStartAt.getTime()).toBe(recentDate.getTime());
		});

		it("should reset if window expired", async () => {
			const userId = "test-user-5";
			const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

			const balance = await CvWindowBalanceModel.create({
				userId,
				windowStartAt: expiredDate,
				used: 7,
				limit: CV_PROCESSING_LIMIT,
			});

			const result = await CvWindowBalanceModel.resetWindowIfExpired(balance);

			expect(result.used).toBe(0);
			expect(result.windowStartAt.getTime()).toBeGreaterThan(
				expiredDate.getTime(),
			);
		});

		it("should preserve time-of-day anchor when resetting", async () => {
			const userId = "test-user-6";
			const oldWindowStart = new Date("2024-01-01T14:37:25.123Z");
			const now = new Date("2024-01-03T16:00:00.000Z");

			vi.setSystemTime(now);

			const balance = await CvWindowBalanceModel.create({
				userId,
				windowStartAt: oldWindowStart,
				used: 8,
				limit: CV_PROCESSING_LIMIT,
			});

			const result = await CvWindowBalanceModel.resetWindowIfExpired(balance);

			expect(result.used).toBe(0);
			expect(result.windowStartAt.getUTCHours()).toBe(14);
			expect(result.windowStartAt.getUTCMinutes()).toBe(37);
			expect(result.windowStartAt.getUTCSeconds()).toBe(25);
			expect(result.windowStartAt.getUTCMilliseconds()).toBe(123);

			const windowEnd = new Date(
				result.windowStartAt.getTime() + 24 * 60 * 60 * 1000,
			);
			expect(now.getTime()).toBeLessThan(windowEnd.getTime());
			expect(now.getTime()).toBeGreaterThanOrEqual(
				result.windowStartAt.getTime(),
			);
		});

		it("should handle edge case when now is exactly at window boundary", async () => {
			const userId = "test-user-7";
			const oldWindowStart = new Date("2024-01-01T12:00:00.000Z");
			const now = new Date("2024-01-02T12:00:00.000Z");

			vi.setSystemTime(now);

			const balance = await CvWindowBalanceModel.create({
				userId,
				windowStartAt: oldWindowStart,
				used: 5,
				limit: CV_PROCESSING_LIMIT,
			});

			const result = await CvWindowBalanceModel.resetWindowIfExpired(balance);

			expect(result.used).toBe(0);
			expect(result.windowStartAt.getTime()).toBe(now.getTime());
		});
	});

	describe("incrementUsage", () => {
		it("should increment usage for new user", async () => {
			const userId = "test-user-8";

			const result = await CvWindowBalanceModel.incrementUsage(userId);

			expect(result.used).toBe(1);
			expect(result.limit).toBe(CV_PROCESSING_LIMIT);
		});

		it("should increment usage for existing user", async () => {
			const userId = "test-user-9";

			await CvWindowBalanceModel.incrementUsage(userId);
			await CvWindowBalanceModel.incrementUsage(userId);
			const result = await CvWindowBalanceModel.incrementUsage(userId);

			expect(result.used).toBe(3);
		});

		it("should persist overuse when limit is reached", async () => {
			const userId = "test-user-10";

			await CvWindowBalanceModel.create({
				userId,
				windowStartAt: new Date(),
				used: CV_PROCESSING_LIMIT,
				limit: CV_PROCESSING_LIMIT,
			});

			const result = await CvWindowBalanceModel.incrementUsage(userId);

			expect(result.used).toBe(CV_PROCESSING_LIMIT + 1);
		});

		it("should allow usage after window reset", async () => {
			const userId = "test-user-11";
			const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

			await CvWindowBalanceModel.create({
				userId,
				windowStartAt: expiredDate,
				used: CV_PROCESSING_LIMIT,
				limit: CV_PROCESSING_LIMIT,
			});

			const result = await CvWindowBalanceModel.incrementUsage(userId);

			expect(result.used).toBe(1);
		});

		it("should handle custom limit and persist overuse", async () => {
			const userId = "test-user-12";
			const customLimit = 5;

			await CvWindowBalanceModel.create({
				userId,
				windowStartAt: new Date(),
				used: 0,
				limit: customLimit,
			});

			for (let i = 0; i < customLimit; i++) {
				await CvWindowBalanceModel.incrementUsage(userId);
			}

			const result = await CvWindowBalanceModel.incrementUsage(userId);

			expect(result.used).toBe(customLimit + 1);
			expect(result.limit).toBe(customLimit);
		});
	});

	describe("checkLimit", () => {
		it("should return allowed true and correct remaining for new user", async () => {
			const userId = "test-user-13";

			const result = await CvWindowBalanceModel.checkLimit(userId);

			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(CV_PROCESSING_LIMIT);
		});

		it("should return correct remaining after usage", async () => {
			const userId = "test-user-14";

			await CvWindowBalanceModel.incrementUsage(userId);
			await CvWindowBalanceModel.incrementUsage(userId);
			await CvWindowBalanceModel.incrementUsage(userId);

			const result = await CvWindowBalanceModel.checkLimit(userId);

			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(CV_PROCESSING_LIMIT - 3);
		});

		it("should return allowed false when limit is reached", async () => {
			const userId = "test-user-15";

			await CvWindowBalanceModel.create({
				userId,
				windowStartAt: new Date(),
				used: CV_PROCESSING_LIMIT,
				limit: CV_PROCESSING_LIMIT,
			});

			const result = await CvWindowBalanceModel.checkLimit(userId);

			expect(result.allowed).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it("should return allowed true after window reset", async () => {
			const userId = "test-user-16";
			const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

			await CvWindowBalanceModel.create({
				userId,
				windowStartAt: expiredDate,
				used: CV_PROCESSING_LIMIT,
				limit: CV_PROCESSING_LIMIT,
			});

			const result = await CvWindowBalanceModel.checkLimit(userId);

			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(CV_PROCESSING_LIMIT);
		});
	});

	describe("rolling window time-of-day preservation", () => {
		it("should maintain same HH:MM:SS across multiple resets", async () => {
			const userId = "test-user-17";
			const initialStart = new Date("2024-01-01T09:15:30.500Z");

			let balance = await CvWindowBalanceModel.create({
				userId,
				windowStartAt: initialStart,
				used: 5,
				limit: CV_PROCESSING_LIMIT,
			});

			const day2 = new Date("2024-01-02T10:00:00.000Z");
			vi.setSystemTime(day2);
			balance = await CvWindowBalanceModel.resetWindowIfExpired(balance);

			expect(balance.windowStartAt.getUTCHours()).toBe(9);
			expect(balance.windowStartAt.getUTCMinutes()).toBe(15);
			expect(balance.windowStartAt.getUTCSeconds()).toBe(30);
			expect(balance.windowStartAt.getUTCMilliseconds()).toBe(500);

			const day3 = new Date("2024-01-03T20:00:00.000Z");
			vi.setSystemTime(day3);
			balance = await CvWindowBalanceModel.resetWindowIfExpired(balance);

			expect(balance.windowStartAt.getUTCHours()).toBe(9);
			expect(balance.windowStartAt.getUTCMinutes()).toBe(15);
			expect(balance.windowStartAt.getUTCSeconds()).toBe(30);
			expect(balance.windowStartAt.getUTCMilliseconds()).toBe(500);
		});

		it("should handle multiple 24h periods elapsed", async () => {
			const userId = "test-user-18";
			const oldStart = new Date("2024-01-01T14:00:00.000Z");
			const now = new Date("2024-01-05T16:00:00.000Z");

			vi.setSystemTime(now);

			const balance = await CvWindowBalanceModel.create({
				userId,
				windowStartAt: oldStart,
				used: 8,
				limit: CV_PROCESSING_LIMIT,
			});

			const result = await CvWindowBalanceModel.resetWindowIfExpired(balance);

			expect(result.windowStartAt.getUTCHours()).toBe(14);
			expect(result.windowStartAt.getUTCMinutes()).toBe(0);
			expect(result.windowStartAt.getUTCSeconds()).toBe(0);

			const expectedStart = new Date("2024-01-05T14:00:00.000Z");
			expect(result.windowStartAt.getTime()).toBe(expectedStart.getTime());

			const windowEnd = new Date(
				result.windowStartAt.getTime() + 24 * 60 * 60 * 1000,
			);
			expect(now.getTime()).toBeGreaterThanOrEqual(
				result.windowStartAt.getTime(),
			);
			expect(now.getTime()).toBeLessThan(windowEnd.getTime());
		});
	});
});
