import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildTabKey,
	cleanupStaleTabData,
	getLastDetectedJD,
	removeLastDetectedJD,
	saveLastDetectedJD,
} from "./storage";
import type { StoredJD } from "./types";

let mockStorage: Record<string, unknown> = {};

function createMockChromeStorage() {
	return {
		get: vi.fn((keys: string | string[] | null) => {
			if (keys === null) {
				return Promise.resolve({ ...mockStorage });
			}
			const keyArray = Array.isArray(keys) ? keys : [keys];
			const result: Record<string, unknown> = {};
			for (const key of keyArray) {
				if (key in mockStorage) {
					result[key] = mockStorage[key];
				}
			}
			return Promise.resolve(result);
		}),
		set: vi.fn((items: Record<string, unknown>) => {
			Object.assign(mockStorage, items);
			return Promise.resolve();
		}),
		remove: vi.fn((keys: string | string[]) => {
			const keyArray = Array.isArray(keys) ? keys : [keys];
			for (const key of keyArray) {
				delete mockStorage[key];
			}
			return Promise.resolve();
		}),
	};
}

const mockChromeTabs = {
	query: vi.fn(),
};

const mockChromeStorage = { local: createMockChromeStorage() };

vi.stubGlobal("chrome", {
	storage: mockChromeStorage,
	tabs: mockChromeTabs,
});

describe("storage - tab-specific JD storage", () => {
	beforeEach(() => {
		mockStorage = {};
		mockChromeStorage.local = createMockChromeStorage();
		mockChromeTabs.query.mockReset();
	});

	describe("buildTabKey", () => {
		it("should create namespaced key with tab: prefix", () => {
			const key = buildTabKey(123, "lastDetectedJD");
			expect(key).toBe("tab:123:lastDetectedJD");
		});

		it("should handle different tab IDs", () => {
			expect(buildTabKey(1, "test")).toBe("tab:1:test");
			expect(buildTabKey(999999, "test")).toBe("tab:999999:test");
		});
	});

	describe("saveLastDetectedJD", () => {
		it("should save JD with namespaced key", async () => {
			const jd: StoredJD = {
				url: "https://example.com/job",
				jobDescriptionAnalysis: {
					isJobDescription: true,
					totalParagraphs: 10,
					jobDescriptionParagraphs: 8,
					paragraphRatio: 0.8,
					sectionRatio: 0.7,
					confidence: 0.9,
					signalDensity: 0.5,
					dominantSignals: ["requirements", "responsibilities"],
				},
				blocks: [{ text: "Job description" }],
				detectedAt: Date.now(),
			};

			await saveLastDetectedJD(123, jd);

			expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
				"tab:123:lastDetectedJD": jd,
			});
		});
	});

	describe("getLastDetectedJD", () => {
		it("should retrieve JD for specific tab", async () => {
			const jd: StoredJD = {
				url: "https://example.com/job",
				jobDescriptionAnalysis: {
					isJobDescription: true,
					totalParagraphs: 10,
					jobDescriptionParagraphs: 8,
					paragraphRatio: 0.8,
					sectionRatio: 0.7,
					confidence: 0.9,
					signalDensity: 0.5,
					dominantSignals: [],
				},
				blocks: [],
				detectedAt: Date.now(),
			};
			mockStorage["tab:123:lastDetectedJD"] = jd;

			const result = await getLastDetectedJD(123);

			expect(result).toEqual(jd);
		});

		it("should return null if no JD stored for tab", async () => {
			const result = await getLastDetectedJD(999);

			expect(result).toBeNull();
		});

		it("should isolate JDs between tabs", async () => {
			const jd1: StoredJD = {
				url: "https://example.com/job1",
				jobDescriptionAnalysis: {
					isJobDescription: true,
					totalParagraphs: 5,
					jobDescriptionParagraphs: 4,
					paragraphRatio: 0.8,
					sectionRatio: 0.7,
					confidence: 0.9,
					signalDensity: 0.5,
					dominantSignals: [],
				},
				blocks: [],
				detectedAt: 1000,
			};
			const jd2: StoredJD = {
				url: "https://example.com/job2",
				jobDescriptionAnalysis: {
					isJobDescription: true,
					totalParagraphs: 10,
					jobDescriptionParagraphs: 9,
					paragraphRatio: 0.9,
					sectionRatio: 0.8,
					confidence: 0.95,
					signalDensity: 0.6,
					dominantSignals: [],
				},
				blocks: [],
				detectedAt: 2000,
			};
			mockStorage["tab:100:lastDetectedJD"] = jd1;
			mockStorage["tab:200:lastDetectedJD"] = jd2;

			const result1 = await getLastDetectedJD(100);
			const result2 = await getLastDetectedJD(200);

			expect(result1?.url).toBe("https://example.com/job1");
			expect(result2?.url).toBe("https://example.com/job2");
		});
	});

	describe("removeLastDetectedJD", () => {
		it("should remove JD for specific tab", async () => {
			mockStorage["tab:123:lastDetectedJD"] = { url: "test" };

			await removeLastDetectedJD(123);

			expect(mockChromeStorage.local.remove).toHaveBeenCalledWith(
				"tab:123:lastDetectedJD",
			);
			expect(mockStorage["tab:123:lastDetectedJD"]).toBeUndefined();
		});

		it("should not affect other tabs", async () => {
			mockStorage["tab:100:lastDetectedJD"] = { url: "job1" };
			mockStorage["tab:200:lastDetectedJD"] = { url: "job2" };

			await removeLastDetectedJD(100);

			expect(mockStorage["tab:100:lastDetectedJD"]).toBeUndefined();
			expect(mockStorage["tab:200:lastDetectedJD"]).toEqual({ url: "job2" });
		});
	});

	describe("cleanupStaleTabData", () => {
		it("should remove data for tabs that no longer exist", async () => {
			mockStorage["tab:100:lastDetectedJD"] = { url: "active" };
			mockStorage["tab:200:lastDetectedJD"] = { url: "stale" };
			mockStorage["tab:300:lastDetectedJD"] = { url: "also-stale" };
			mockStorage.supabaseSession = { token: "keep-this" };

			mockChromeTabs.query.mockResolvedValue([{ id: 100 }]);

			await cleanupStaleTabData();

			expect(mockChromeStorage.local.remove).toHaveBeenCalledWith([
				"tab:200:lastDetectedJD",
				"tab:300:lastDetectedJD",
			]);
		});

		it("should not remove data for active tabs", async () => {
			mockStorage["tab:100:lastDetectedJD"] = { url: "active1" };
			mockStorage["tab:200:lastDetectedJD"] = { url: "active2" };

			mockChromeTabs.query.mockResolvedValue([{ id: 100 }, { id: 200 }]);

			await cleanupStaleTabData();

			expect(mockChromeStorage.local.remove).not.toHaveBeenCalled();
		});

		it("should not remove non-tab-prefixed keys", async () => {
			mockStorage.supabaseSession = { token: "keep" };
			mockStorage.someOtherKey = { data: "keep" };
			mockStorage["tab:999:lastDetectedJD"] = { url: "stale" };

			mockChromeTabs.query.mockResolvedValue([]);

			await cleanupStaleTabData();

			expect(mockChromeStorage.local.remove).toHaveBeenCalledWith([
				"tab:999:lastDetectedJD",
			]);
			expect(mockStorage.supabaseSession).toBeDefined();
			expect(mockStorage.someOtherKey).toBeDefined();
		});

		it("should handle tabs with undefined IDs", async () => {
			mockStorage["tab:100:lastDetectedJD"] = { url: "active" };

			mockChromeTabs.query.mockResolvedValue([
				{ id: 100 },
				{ id: undefined },
				{},
			]);

			await cleanupStaleTabData();

			expect(mockChromeStorage.local.remove).not.toHaveBeenCalled();
		});

		it("should handle empty storage", async () => {
			mockChromeTabs.query.mockResolvedValue([{ id: 100 }]);

			await cleanupStaleTabData();

			expect(mockChromeStorage.local.remove).not.toHaveBeenCalled();
		});

		it("should handle crash recovery scenario", async () => {
			mockStorage["tab:1:lastDetectedJD"] = { url: "old-tab-1" };
			mockStorage["tab:2:lastDetectedJD"] = { url: "old-tab-2" };
			mockStorage["tab:3:lastDetectedJD"] = { url: "old-tab-3" };

			mockChromeTabs.query.mockResolvedValue([{ id: 100 }, { id: 101 }]);

			await cleanupStaleTabData();

			expect(mockChromeStorage.local.remove).toHaveBeenCalledWith([
				"tab:1:lastDetectedJD",
				"tab:2:lastDetectedJD",
				"tab:3:lastDetectedJD",
			]);
		});
	});
});
