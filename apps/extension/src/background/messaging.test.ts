import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredSession } from "../lib/supabase";
import { broadcastAuthChange, isExpectedError } from "./messaging";

// Mock chrome APIs
const mockSendMessage = vi.fn();
const mockQuery = vi.fn();

vi.stubGlobal("chrome", {
	tabs: {
		query: mockQuery,
		sendMessage: mockSendMessage,
	},
	runtime: {
		lastError: null,
	},
});

describe("messaging", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("broadcastAuthChange", () => {
		const mockSession: StoredSession = {
			access_token: "test-access-token",
			refresh_token: "test-refresh-token",
			expires_at: 1234567890,
			user: null,
		};

		it("should query all tabs", async () => {
			mockQuery.mockResolvedValue([]);

			await broadcastAuthChange(mockSession);

			expect(mockQuery).toHaveBeenCalledWith({});
		});

		it("should send AUTH_CHANGED message to each tab with an id", async () => {
			mockQuery.mockResolvedValue([
				{ id: 1, url: "https://example.com" },
				{ id: 2, url: "https://test.com" },
				{ id: 3, url: "https://another.com" },
			]);

			await broadcastAuthChange(mockSession);

			expect(mockSendMessage).toHaveBeenCalledTimes(3);
			expect(mockSendMessage).toHaveBeenCalledWith(
				1,
				{ type: "AUTH_CHANGED", session: mockSession },
				expect.any(Function),
			);
			expect(mockSendMessage).toHaveBeenCalledWith(
				2,
				{ type: "AUTH_CHANGED", session: mockSession },
				expect.any(Function),
			);
			expect(mockSendMessage).toHaveBeenCalledWith(
				3,
				{ type: "AUTH_CHANGED", session: mockSession },
				expect.any(Function),
			);
		});

		it("should skip tabs without an id", async () => {
			mockQuery.mockResolvedValue([
				{ id: 1, url: "https://example.com" },
				{ url: "https://no-id.com" }, // No id
				{ id: undefined, url: "https://undefined-id.com" },
				{ id: 2, url: "https://test.com" },
			]);

			await broadcastAuthChange(mockSession);

			expect(mockSendMessage).toHaveBeenCalledTimes(2);
			expect(mockSendMessage).toHaveBeenCalledWith(
				1,
				expect.any(Object),
				expect.any(Function),
			);
			expect(mockSendMessage).toHaveBeenCalledWith(
				2,
				expect.any(Object),
				expect.any(Function),
			);
		});

		it("should broadcast null session on logout", async () => {
			mockQuery.mockResolvedValue([{ id: 1 }]);

			await broadcastAuthChange(null);

			expect(mockSendMessage).toHaveBeenCalledWith(
				1,
				{ type: "AUTH_CHANGED", session: null },
				expect.any(Function),
			);
		});

		it("should handle empty tabs list", async () => {
			mockQuery.mockResolvedValue([]);

			await broadcastAuthChange(mockSession);

			expect(mockSendMessage).not.toHaveBeenCalled();
		});

		it("should not throw when sendMessage callback is invoked", async () => {
			mockQuery.mockResolvedValue([{ id: 1 }]);
			mockSendMessage.mockImplementation((_tabId, _message, callback) => {
				// Simulate callback being called (as Chrome does)
				callback();
			});

			await expect(broadcastAuthChange(mockSession)).resolves.not.toThrow();
		});
	});

	describe("isExpectedError", () => {
		it("should return true for 'Receiving end does not exist' error", () => {
			expect(isExpectedError("Receiving end does not exist")).toBe(true);
		});

		it("should return true when message contains the expected error substring", () => {
			expect(
				isExpectedError("Error: Receiving end does not exist for this tab"),
			).toBe(true);
		});

		it("should return false for other error messages", () => {
			expect(isExpectedError("Some other error")).toBe(false);
			expect(isExpectedError("Connection failed")).toBe(false);
		});

		it("should return false for undefined message", () => {
			expect(isExpectedError(undefined)).toBe(false);
		});

		it("should return false for empty string", () => {
			expect(isExpectedError("")).toBe(false);
		});
	});
});
