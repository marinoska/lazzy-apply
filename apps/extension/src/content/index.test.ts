import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationForm } from "./scanner/formDetector.js";

// Mock chrome API
const mockChrome = {
	runtime: {
		sendMessage: vi.fn(),
		onMessage: {
			addListener: vi.fn(),
		},
		lastError: null,
	},
};

vi.stubGlobal("chrome", mockChrome);

describe("content/index initialization", () => {
	// Shared state for capturing callbacks
	let capturedNavigationCallback: ((url: string) => void) | undefined;
	let capturedIframeFormCallback: ((form: ApplicationForm) => void) | undefined;
	let mockSidebar: {
		show: ReturnType<typeof vi.fn>;
		hide: ReturnType<typeof vi.fn>;
		updateSession: ReturnType<typeof vi.fn>;
		showError: ReturnType<typeof vi.fn>;
		isVisible: ReturnType<typeof vi.fn>;
	};
	let mockScanPage: ReturnType<typeof vi.fn>;
	let mockFormStoreIsParent: boolean;

	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		capturedNavigationCallback = undefined;
		capturedIframeFormCallback = undefined;
		mockFormStoreIsParent = true;

		mockSidebar = {
			show: vi.fn().mockResolvedValue(undefined),
			hide: vi.fn(),
			updateSession: vi.fn(),
			showError: vi.fn(),
			isVisible: vi.fn().mockReturnValue(false),
		};

		mockScanPage = vi.fn();

		// Set up mocks before each test
		vi.doMock("./scanner/FormStoreManager.js", () => ({
			formStore: {
				get isParent() {
					return mockFormStoreIsParent;
				},
				get isIframe() {
					return !mockFormStoreIsParent;
				},
				onIframeFormReceived: vi.fn((cb: (form: ApplicationForm) => void) => {
					capturedIframeFormCallback = cb;
				}),
			},
		}));

		vi.doMock("./scanner/navigationWatcher.js", () => ({
			NavigationWatcher: vi.fn((cb: (url: string) => void) => {
				capturedNavigationCallback = cb;
				return { disconnect: vi.fn() };
			}),
		}));

		vi.doMock("./scanner/scanner.js", () => ({
			scanPage: mockScanPage,
		}));

		vi.doMock("./sidebar/index.js", () => ({
			default: vi.fn(() => mockSidebar),
		}));
	});

	afterEach(() => {
		vi.resetModules();
	});

	describe("NavigationWatcher callback", () => {
		it("should auto-show sidebar when form detected in parent frame", async () => {
			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 3,
				fields: [],
				url: "https://example.com/apply",
				fieldElements: new Map(),
			};
			mockScanPage.mockReturnValue(mockForm);
			mockFormStoreIsParent = true;

			await import("./index.js");

			expect(capturedNavigationCallback).toBeDefined();

			// Simulate navigation callback
			capturedNavigationCallback?.("https://example.com/apply");

			expect(mockScanPage).toHaveBeenCalled();
			expect(mockSidebar.show).toHaveBeenCalledTimes(1);
		});

		it("should not show sidebar multiple times for the same form (deduplication)", async () => {
			const mockForm: ApplicationForm = {
				formHash: "test-hash-123",
				formDetected: true,
				totalFields: 3,
				fields: [],
				url: "https://example.com/apply",
				fieldElements: new Map(),
			};
			mockScanPage.mockReturnValue(mockForm);
			mockFormStoreIsParent = true;

			await import("./index.js");

			// Simulate multiple navigation callbacks with the same form (e.g., DOM changes during page load)
			capturedNavigationCallback?.("https://example.com/apply");
			capturedNavigationCallback?.("https://example.com/apply");
			capturedNavigationCallback?.("https://example.com/apply");

			expect(mockScanPage).toHaveBeenCalledTimes(3);
			// Sidebar should only be shown once, not 3 times
			expect(mockSidebar.show).toHaveBeenCalledTimes(1);
		});

		it("should show sidebar again when a different form is detected", async () => {
			const mockForm1: ApplicationForm = {
				formHash: "form-hash-1",
				formDetected: true,
				totalFields: 3,
				fields: [],
				url: "https://example.com/apply/job1",
				fieldElements: new Map(),
			};
			const mockForm2: ApplicationForm = {
				formHash: "form-hash-2",
				formDetected: true,
				totalFields: 4,
				fields: [],
				url: "https://example.com/apply/job2",
				fieldElements: new Map(),
			};
			mockFormStoreIsParent = true;

			await import("./index.js");

			// First form detected
			mockScanPage.mockReturnValue(mockForm1);
			capturedNavigationCallback?.("https://example.com/apply/job1");

			expect(mockSidebar.show).toHaveBeenCalledTimes(1);

			// Same form detected again (should not show sidebar)
			capturedNavigationCallback?.("https://example.com/apply/job1");
			expect(mockSidebar.show).toHaveBeenCalledTimes(1);

			// Different form detected (should show sidebar again)
			mockScanPage.mockReturnValue(mockForm2);
			capturedNavigationCallback?.("https://example.com/apply/job2");

			expect(mockSidebar.show).toHaveBeenCalledTimes(2);
		});

		it("should not show sidebar when no form detected", async () => {
			mockScanPage.mockReturnValue(null);
			mockFormStoreIsParent = true;

			await import("./index.js");

			capturedNavigationCallback?.("https://example.com/jobs");

			expect(mockScanPage).toHaveBeenCalled();
			expect(mockSidebar.show).not.toHaveBeenCalled();
		});

		it("should not show sidebar when formDetected is false", async () => {
			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: false,
				totalFields: 0,
				fields: [],
				url: "https://example.com/page",
				fieldElements: new Map(),
			};
			mockScanPage.mockReturnValue(mockForm);
			mockFormStoreIsParent = true;

			await import("./index.js");

			capturedNavigationCallback?.("https://example.com/page");

			expect(mockScanPage).toHaveBeenCalled();
			expect(mockSidebar.show).not.toHaveBeenCalled();
		});

		it("should not show sidebar when in iframe (not parent)", async () => {
			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 3,
				fields: [],
				url: "https://example.com/apply",
				fieldElements: new Map(),
			};
			mockScanPage.mockReturnValue(mockForm);
			mockFormStoreIsParent = false;

			await import("./index.js");

			capturedNavigationCallback?.("https://example.com/apply");

			expect(mockScanPage).toHaveBeenCalled();
			expect(mockSidebar.show).not.toHaveBeenCalled();
		});
	});

	describe("onIframeFormReceived callback", () => {
		it("should register callback and show sidebar when form received from iframe", async () => {
			mockFormStoreIsParent = true;

			await import("./index.js");

			const { formStore } = await import("./scanner/FormStoreManager.js");

			expect(formStore.onIframeFormReceived).toHaveBeenCalledWith(
				expect.any(Function),
			);
			expect(capturedIframeFormCallback).toBeDefined();

			const mockForm: ApplicationForm = {
				formHash: "iframe-form-hash",
				formDetected: true,
				totalFields: 3,
				fields: [],
				url: "https://example.com/apply",
				fieldElements: new Map(),
			};

			// Simulate iframe form received
			capturedIframeFormCallback?.(mockForm);

			expect(mockSidebar.show).toHaveBeenCalledTimes(1);
		});

		it("should not show sidebar multiple times for the same iframe form (deduplication)", async () => {
			mockFormStoreIsParent = true;

			await import("./index.js");

			const mockForm: ApplicationForm = {
				formHash: "iframe-form-hash-456",
				formDetected: true,
				totalFields: 3,
				fields: [],
				url: "https://example.com/apply",
				fieldElements: new Map(),
			};

			// Simulate multiple iframe form received events with the same form
			capturedIframeFormCallback?.(mockForm);
			capturedIframeFormCallback?.(mockForm);
			capturedIframeFormCallback?.(mockForm);

			// Sidebar should only be shown once
			expect(mockSidebar.show).toHaveBeenCalledTimes(1);
		});

		it("should show sidebar again when a different iframe form is received", async () => {
			mockFormStoreIsParent = true;

			await import("./index.js");

			const mockForm1: ApplicationForm = {
				formHash: "iframe-form-1",
				formDetected: true,
				totalFields: 3,
				fields: [],
				url: "https://example.com/apply/job1",
				fieldElements: new Map(),
			};
			const mockForm2: ApplicationForm = {
				formHash: "iframe-form-2",
				formDetected: true,
				totalFields: 4,
				fields: [],
				url: "https://example.com/apply/job2",
				fieldElements: new Map(),
			};

			// First form received
			capturedIframeFormCallback?.(mockForm1);
			expect(mockSidebar.show).toHaveBeenCalledTimes(1);

			// Same form received again (should not show sidebar)
			capturedIframeFormCallback?.(mockForm1);
			expect(mockSidebar.show).toHaveBeenCalledTimes(1);

			// Different form received (should show sidebar again)
			capturedIframeFormCallback?.(mockForm2);
			expect(mockSidebar.show).toHaveBeenCalledTimes(2);
		});

		it("should not register callback when in iframe (not parent)", async () => {
			mockFormStoreIsParent = false;

			await import("./index.js");

			const { formStore } = await import("./scanner/FormStoreManager.js");

			expect(formStore.onIframeFormReceived).not.toHaveBeenCalled();
		});
	});

	describe("message listener registration", () => {
		it("should register message listener when in parent frame", async () => {
			mockFormStoreIsParent = true;

			await import("./index.js");

			expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
				expect.any(Function),
			);
		});

		it("should not register message listener when in iframe", async () => {
			mockFormStoreIsParent = false;

			await import("./index.js");

			expect(mockChrome.runtime.onMessage.addListener).not.toHaveBeenCalled();
		});
	});
});
