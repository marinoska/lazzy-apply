import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrap, logout, setupAuthListener } from "./auth";

// Mock dependencies
vi.mock("./messaging.js", () => ({
	broadcastAuthChange: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./storage.js", () => ({
	getStoredSession: vi.fn(),
	saveSession: vi.fn().mockResolvedValue(undefined),
	removeSession: vi.fn().mockResolvedValue(undefined),
}));

const mockSignOut = vi.fn();
const mockSetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("../lib/supabase.js", () => ({
	getSupabase: () => ({
		auth: {
			signOut: mockSignOut,
			setSession: mockSetSession,
			onAuthStateChange: mockOnAuthStateChange,
		},
	}),
}));

// Import mocked modules
import { broadcastAuthChange } from "./messaging.js";
import { getStoredSession, removeSession, saveSession } from "./storage.js";

describe("auth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	describe("logout", () => {
		it("should sign out from supabase", async () => {
			mockSignOut.mockResolvedValue({ error: null });

			await logout();

			expect(mockSignOut).toHaveBeenCalled();
		});

		it("should remove stored session", async () => {
			mockSignOut.mockResolvedValue({ error: null });

			await logout();

			expect(removeSession).toHaveBeenCalled();
		});

		it("should broadcast null session to all tabs", async () => {
			mockSignOut.mockResolvedValue({ error: null });

			await logout();

			expect(broadcastAuthChange).toHaveBeenCalledWith(null);
		});

		it("should call operations in correct order", async () => {
			const callOrder: string[] = [];
			mockSignOut.mockImplementation(async () => {
				callOrder.push("signOut");
				return { error: null };
			});
			vi.mocked(removeSession).mockImplementation(async () => {
				callOrder.push("removeSession");
			});
			vi.mocked(broadcastAuthChange).mockImplementation(async () => {
				callOrder.push("broadcastAuthChange");
			});

			await logout();

			expect(callOrder).toEqual([
				"signOut",
				"removeSession",
				"broadcastAuthChange",
			]);
		});
	});

	describe("setupAuthListener", () => {
		it("should register auth state change listener", () => {
			setupAuthListener();

			expect(mockOnAuthStateChange).toHaveBeenCalledWith(expect.any(Function));
		});

		it("should save and broadcast session on TOKEN_REFRESHED", async () => {
			setupAuthListener();

			const authCallback = mockOnAuthStateChange.mock.calls[0][0];
			const mockSession = {
				access_token: "new-access-token",
				refresh_token: "new-refresh-token",
				expires_at: "2024-01-01T00:00:00.000Z",
				user: null,
			};

			await authCallback("TOKEN_REFRESHED", mockSession);

			expect(saveSession).toHaveBeenCalledWith({
				access_token: "new-access-token",
				refresh_token: "new-refresh-token",
				expires_at: expect.any(Number),
				user: null,
			});
			expect(broadcastAuthChange).toHaveBeenCalledWith({
				access_token: "new-access-token",
				refresh_token: "new-refresh-token",
				expires_at: expect.any(Number),
				user: null,
			});
		});

		it("should remove session and broadcast null on SIGNED_OUT", async () => {
			setupAuthListener();

			const authCallback = mockOnAuthStateChange.mock.calls[0][0];

			await authCallback("SIGNED_OUT", null);

			expect(removeSession).toHaveBeenCalled();
			expect(broadcastAuthChange).toHaveBeenCalledWith(null);
		});

		it("should not act on other auth events", async () => {
			setupAuthListener();

			const authCallback = mockOnAuthStateChange.mock.calls[0][0];

			await authCallback("INITIAL_SESSION", null);

			expect(saveSession).not.toHaveBeenCalled();
			expect(removeSession).not.toHaveBeenCalled();
			expect(broadcastAuthChange).not.toHaveBeenCalled();
		});
	});

	describe("bootstrap", () => {
		it("should return early if no stored session", async () => {
			vi.mocked(getStoredSession).mockResolvedValue(null);

			await bootstrap();

			expect(mockSetSession).not.toHaveBeenCalled();
		});

		it("should return early if session has no access_token", async () => {
			vi.mocked(getStoredSession).mockResolvedValue({
				access_token: "",
				refresh_token: "test-refresh",
				expires_at: null,
				user: null,
			});

			await bootstrap();

			expect(mockSetSession).not.toHaveBeenCalled();
		});

		it("should return early if session has no refresh_token", async () => {
			vi.mocked(getStoredSession).mockResolvedValue({
				access_token: "test-access",
				refresh_token: "",
				expires_at: null,
				user: null,
			});

			await bootstrap();

			expect(mockSetSession).not.toHaveBeenCalled();
		});

		it("should restore session from storage", async () => {
			vi.mocked(getStoredSession).mockResolvedValue({
				access_token: "stored-access",
				refresh_token: "stored-refresh",
				expires_at: 1234567890,
				user: null,
			});
			mockSetSession.mockResolvedValue({
				data: { session: null },
				error: null,
			});

			await bootstrap();

			expect(mockSetSession).toHaveBeenCalledWith({
				access_token: "stored-access",
				refresh_token: "stored-refresh",
			});
		});

		it("should remove session and broadcast null on restore error", async () => {
			vi.mocked(getStoredSession).mockResolvedValue({
				access_token: "stored-access",
				refresh_token: "stored-refresh",
				expires_at: null,
				user: null,
			});
			mockSetSession.mockResolvedValue({
				data: null,
				error: { message: "Session expired" },
			});

			await bootstrap();

			expect(removeSession).toHaveBeenCalled();
			expect(broadcastAuthChange).toHaveBeenCalledWith(null);
		});

		it("should save and broadcast refreshed session", async () => {
			vi.mocked(getStoredSession).mockResolvedValue({
				access_token: "old-access",
				refresh_token: "old-refresh",
				expires_at: null,
				user: null,
			});
			mockSetSession.mockResolvedValue({
				data: {
					session: {
						access_token: "new-access",
						refresh_token: "new-refresh",
						expires_at: "2024-01-01T00:00:00.000Z",
						user: { id: "user-123" },
					},
				},
				error: null,
			});

			await bootstrap();

			expect(saveSession).toHaveBeenCalledWith({
				access_token: "new-access",
				refresh_token: "new-refresh",
				expires_at: expect.any(Number),
				user: { id: "user-123" },
			});
			expect(broadcastAuthChange).toHaveBeenCalledWith({
				access_token: "new-access",
				refresh_token: "new-refresh",
				expires_at: expect.any(Number),
				user: { id: "user-123" },
			});
		});

		it("should not save or broadcast if session was not refreshed", async () => {
			vi.mocked(getStoredSession).mockResolvedValue({
				access_token: "stored-access",
				refresh_token: "stored-refresh",
				expires_at: null,
				user: null,
			});
			mockSetSession.mockResolvedValue({
				data: { session: null },
				error: null,
			});

			await bootstrap();

			expect(saveSession).not.toHaveBeenCalled();
			expect(broadcastAuthChange).not.toHaveBeenCalled();
		});
	});
});
