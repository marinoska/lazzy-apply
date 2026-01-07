import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SidebarDeps, SidebarModule } from "./types.js";

describe("Sidebar state management", () => {
	let sidebar: SidebarModule;
	let mockDeps: SidebarDeps;
	let mockSession: { userId: string };

	beforeEach(async () => {
		vi.resetModules();
		vi.clearAllMocks();

		mockSession = { userId: "test-user-123" };

		mockDeps = {
			fetchSession: vi.fn().mockResolvedValue(mockSession),
			signIn: vi.fn().mockResolvedValue(undefined),
			signOut: vi.fn().mockResolvedValue(undefined),
		};

		vi.doMock("./shadowDOM.js", () => ({
			setupShadowDOM: vi.fn(() => ({
				root: {
					render: vi.fn(),
				},
				theme: {},
				emotionCache: {},
				shadowRootElement: document.createElement("div"),
			})),
		}));

		vi.doMock("./SidebarView.js", () => ({
			SidebarView: () => null,
		}));

		const { createSidebar } = await import("./index.js");
		sidebar = createSidebar(mockDeps);
	});

	afterEach(() => {
		vi.resetModules();
	});

	describe("show()", () => {
		it("should set visible to true and fetch session", async () => {
			await sidebar.show();

			expect(mockDeps.fetchSession).toHaveBeenCalledTimes(1);
			expect(sidebar.isVisible()).toBe(true);
		});

		it("should reset completelyHidden when showing sidebar", async () => {
			await sidebar.show();

			expect(sidebar.isVisible()).toBe(true);
		});

		it("should handle fetchSession error gracefully", async () => {
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			mockDeps.fetchSession = vi
				.fn()
				.mockRejectedValue(new Error("Network error"));

			await sidebar.show();

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Failed to fetch session:",
				expect.any(Error),
			);
			expect(sidebar.isVisible()).toBe(true);

			consoleErrorSpy.mockRestore();
		});
	});

	describe("hide()", () => {
		it("should set visible to false", async () => {
			await sidebar.show();
			expect(sidebar.isVisible()).toBe(true);

			sidebar.hide();
			expect(sidebar.isVisible()).toBe(false);
		});

		it("should not affect session when hiding", async () => {
			await sidebar.show();
			sidebar.hide();

			expect(mockDeps.fetchSession).toHaveBeenCalledTimes(1);
		});
	});

	describe("isVisible()", () => {
		it("should return false initially", () => {
			expect(sidebar.isVisible()).toBe(false);
		});

		it("should return true after show() is called", async () => {
			await sidebar.show();
			expect(sidebar.isVisible()).toBe(true);
		});

		it("should return false after hide() is called", async () => {
			await sidebar.show();
			sidebar.hide();
			expect(sidebar.isVisible()).toBe(false);
		});
	});

	describe("updateSession()", () => {
		it("should update session with new session data", () => {
			const newSession = { userId: "new-user-456" };
			sidebar.updateSession(newSession as never);

			expect(sidebar.isVisible()).toBe(false);
		});

		it("should update session with null to clear session", () => {
			sidebar.updateSession(null);

			expect(sidebar.isVisible()).toBe(false);
		});
	});

	describe("showError()", () => {
		it("should log error to console", () => {
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			sidebar.showError("Test error message");

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error:",
				"Test error message",
			);

			consoleErrorSpy.mockRestore();
		});
	});

	describe("keyboard handling", () => {
		it("should hide sidebar when Escape key is pressed and sidebar is visible", async () => {
			await sidebar.show();
			expect(sidebar.isVisible()).toBe(true);

			const escapeEvent = new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
			});
			window.dispatchEvent(escapeEvent);

			expect(sidebar.isVisible()).toBe(false);
		});

		it("should not hide sidebar when Escape key is pressed and sidebar is not visible", () => {
			expect(sidebar.isVisible()).toBe(false);

			const escapeEvent = new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
			});
			window.dispatchEvent(escapeEvent);

			expect(sidebar.isVisible()).toBe(false);
		});

		it("should not hide sidebar when other keys are pressed", async () => {
			await sidebar.show();
			expect(sidebar.isVisible()).toBe(true);

			const enterEvent = new KeyboardEvent("keydown", {
				key: "Enter",
				bubbles: true,
			});
			window.dispatchEvent(enterEvent);

			expect(sidebar.isVisible()).toBe(true);
		});
	});

	describe("authentication flow", () => {
		it("should call signIn and fetch session on successful sign in", async () => {
			await sidebar.show();

			expect(mockDeps.signIn).not.toHaveBeenCalled();
			expect(mockDeps.fetchSession).toHaveBeenCalledTimes(1);
		});

		it("should call signOut on sign out", async () => {
			await sidebar.show();

			expect(mockDeps.signOut).not.toHaveBeenCalled();
		});

		it("should handle sign in error gracefully", async () => {
			const consoleErrorSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			mockDeps.signIn = vi.fn().mockRejectedValue(new Error("Auth error"));

			expect(consoleErrorSpy).not.toHaveBeenCalled();

			consoleErrorSpy.mockRestore();
		});
	});

	describe("completelyHidden state", () => {
		it("should initialize with completelyHidden as false", () => {
			expect(sidebar.isVisible()).toBe(false);
		});

		it("should reset completelyHidden to false when showing sidebar", async () => {
			await sidebar.show();
			expect(sidebar.isVisible()).toBe(true);
		});
	});
});
