import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormStoreManager } from "./FormStoreManager.js";
import type { ApplicationForm } from "./formDetector.js";

describe("FormStoreManager", () => {
	let manager: FormStoreManager;

	// Store original window properties
	const originalSelf = window.self;
	const originalTop = window.top;
	const originalParent = window.parent;

	beforeEach(() => {
		manager = new FormStoreManager();
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Restore window properties
		Object.defineProperty(window, "self", {
			value: originalSelf,
			writable: true,
		});
		Object.defineProperty(window, "top", {
			value: originalTop,
			writable: true,
		});
		Object.defineProperty(window, "parent", {
			value: originalParent,
			writable: true,
		});
	});

	describe("isIframe", () => {
		it("should be false when window.self equals window.top", () => {
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			const mgr = new FormStoreManager();
			expect(mgr.isIframe).toBe(false);
		});

		it("should be true when window.self does not equal window.top", () => {
			const mockTop = {} as Window;
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: mockTop, writable: true });

			const mgr = new FormStoreManager();
			expect(mgr.isIframe).toBe(true);
		});

		it("should be true when accessing window.top throws (cross-origin)", () => {
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", {
				get() {
					throw new Error("cross-origin");
				},
			});

			const mgr = new FormStoreManager();
			expect(mgr.isIframe).toBe(true);
		});
	});

	describe("isParent", () => {
		it("should be true when not in iframe", () => {
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			const mgr = new FormStoreManager();
			expect(mgr.isParent).toBe(true);
		});

		it("should be false when in iframe", () => {
			const mockTop = {} as Window;
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: mockTop, writable: true });

			const mgr = new FormStoreManager();
			expect(mgr.isParent).toBe(false);
		});
	});

	describe("broadcastFormToParent", () => {
		it("should not post message when not in iframe", () => {
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			const postMessageSpy = vi.fn();
			Object.defineProperty(window, "parent", {
				value: { postMessage: postMessageSpy },
				writable: true,
			});

			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				fieldElements: new Map(),
			};

			manager.broadcastFormToParent(mockForm);

			expect(postMessageSpy).not.toHaveBeenCalled();
		});

		it("should post message to parent when in iframe", () => {
			const mockTop = {} as Window;
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: mockTop, writable: true });

			const postMessageSpy = vi.fn();
			Object.defineProperty(window, "parent", {
				value: { postMessage: postMessageSpy },
				writable: true,
			});

			// Create manager after setting up iframe context
			const mgr = new FormStoreManager();

			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 2,
				fields: [
					{
						hash: "field-1",
						tag: "input",
						type: "text",
						name: "email",
						label: "Email",
						placeholder: null,
						description: null,
						isFileUpload: false,
					},
				],
				fieldElements: new Map([["field-1", document.createElement("input")]]),
			};

			mgr.broadcastFormToParent(mockForm);

			expect(postMessageSpy).toHaveBeenCalledWith(
				{
					type: "LAZYAPPLY_FORM_DETECTED",
					form: {
						formHash: "test-hash",
						formDetected: true,
						totalFields: 2,
						fields: mockForm.fields,
						fieldElements: ["field-1"],
					},
				},
				"*",
			);
		});
	});

	describe("requestFormFromIframes", () => {
		it("should not request when in iframe", () => {
			const mockTop = {} as Window;
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: mockTop, writable: true });

			// Create manager after setting up iframe context
			const mgr = new FormStoreManager();

			const iframe = document.createElement("iframe");
			const postMessageSpy = vi.fn();
			Object.defineProperty(iframe, "contentWindow", {
				value: { postMessage: postMessageSpy },
			});
			document.body.appendChild(iframe);

			mgr.requestFormFromIframes();

			expect(postMessageSpy).not.toHaveBeenCalled();

			document.body.removeChild(iframe);
		});

		it("should post message to all iframes when in parent frame", () => {
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			const iframe1 = document.createElement("iframe");
			const iframe2 = document.createElement("iframe");
			const postMessageSpy1 = vi.fn();
			const postMessageSpy2 = vi.fn();

			Object.defineProperty(iframe1, "contentWindow", {
				value: { postMessage: postMessageSpy1 },
			});
			Object.defineProperty(iframe2, "contentWindow", {
				value: { postMessage: postMessageSpy2 },
			});

			document.body.appendChild(iframe1);
			document.body.appendChild(iframe2);

			manager.requestFormFromIframes();

			expect(postMessageSpy1).toHaveBeenCalledWith(
				{ type: "LAZYAPPLY_FORM_REQUEST" },
				"*",
			);
			expect(postMessageSpy2).toHaveBeenCalledWith(
				{ type: "LAZYAPPLY_FORM_REQUEST" },
				"*",
			);

			document.body.removeChild(iframe1);
			document.body.removeChild(iframe2);
		});
	});

	describe("constructor", () => {
		it("should add message event listener on construction", () => {
			const addEventListenerSpy = vi.spyOn(window, "addEventListener");

			new FormStoreManager();

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				"message",
				expect.any(Function),
			);

			addEventListenerSpy.mockRestore();
		});
	});

	describe("getStoredForm", () => {
		it("should return null when no form is stored", () => {
			expect(manager.getStoredForm()).toBeNull();
		});
	});

	describe("getFormSourceWindow", () => {
		it("should return null when no form source is set", () => {
			expect(manager.getFormSourceWindow()).toBeNull();
		});
	});

	describe("fillFieldInIframe", () => {
		it("should not throw when no form source window is set", () => {
			expect(() => manager.fillFieldInIframe("hash", "value")).not.toThrow();
		});
	});

	describe("setCachedIframeForm", () => {
		it("should cache the form", () => {
			const mockForm: ApplicationForm = {
				formHash: "cached-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				fieldElements: new Map(),
			};

			manager.setCachedIframeForm(mockForm);

			// The cached form is used internally, we can't directly access it
			// but we can verify it doesn't throw
			expect(() => manager.setCachedIframeForm(mockForm)).not.toThrow();
		});
	});

	describe("message handling", () => {
		it("should store form data when receiving LAZYAPPLY_FORM_DETECTED message", async () => {
			// Set up as parent frame before creating manager
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			const mgr = new FormStoreManager();

			const mockFormData = {
				formHash: "received-hash",
				formDetected: true,
				totalFields: 1,
				fields: [
					{
						hash: "field-hash",
						tag: "input",
						type: "text",
						name: "test",
						label: "Test",
						placeholder: null,
						description: null,
						isFileUpload: false,
					},
				],
				fieldElements: ["field-hash"],
			};

			const messageEvent = new MessageEvent("message", {
				data: {
					type: "LAZYAPPLY_FORM_DETECTED",
					form: mockFormData,
				},
				origin: "https://example.com",
				source: window,
			});

			window.dispatchEvent(messageEvent);

			await new Promise((resolve) => setTimeout(resolve, 0));

			const storedForm = mgr.getStoredForm();
			expect(storedForm).not.toBeNull();
			expect(storedForm?.formHash).toBe("received-hash");
			expect(storedForm?.fields).toHaveLength(1);
		});

		it("should ignore messages without valid type", () => {
			const messageEvent = new MessageEvent("message", {
				data: { invalid: "data" },
			});

			expect(() => window.dispatchEvent(messageEvent)).not.toThrow();
		});

		it("should ignore null message data", () => {
			const messageEvent = new MessageEvent("message", {
				data: null,
			});

			expect(() => window.dispatchEvent(messageEvent)).not.toThrow();
		});
	});
});
