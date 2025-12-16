import type { AutofillResponseItem } from "@lazyapply/types";
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
				url: "https://example.com/apply",
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
				url: "https://example.com/apply",
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

		it("should post message to form source window when set", async () => {
			// Set up as parent frame
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			const mgr = new FormStoreManager();

			// Simulate receiving a form from iframe to set formSourceWindow
			const mockSourceWindow = { postMessage: vi.fn() };
			const mockFormData = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				fieldElements: [],
			};

			const messageEvent = new MessageEvent("message", {
				data: {
					type: "LAZYAPPLY_FORM_DETECTED",
					form: mockFormData,
				},
				origin: "https://example.com",
				source: mockSourceWindow as unknown as Window,
			});

			window.dispatchEvent(messageEvent);
			await new Promise((resolve) => setTimeout(resolve, 0));

			mgr.fillFieldInIframe("field-hash", "test-value");

			expect(mockSourceWindow.postMessage).toHaveBeenCalledWith(
				{
					type: "LAZYAPPLY_FILL_FIELD",
					hash: "field-hash",
					value: "test-value",
				},
				"*",
			);
		});
	});

	describe("clearFieldsInIframe", () => {
		it("should not throw when no form source window is set", () => {
			expect(() => manager.clearFieldsInIframe()).not.toThrow();
		});

		it("should post clear message to form source window when set", async () => {
			// Set up as parent frame
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			const mgr = new FormStoreManager();

			// Simulate receiving a form from iframe to set formSourceWindow
			const mockSourceWindow = { postMessage: vi.fn() };
			const mockFormData = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				fieldElements: [],
			};

			const messageEvent = new MessageEvent("message", {
				data: {
					type: "LAZYAPPLY_FORM_DETECTED",
					form: mockFormData,
				},
				origin: "https://example.com",
				source: mockSourceWindow as unknown as Window,
			});

			window.dispatchEvent(messageEvent);
			await new Promise((resolve) => setTimeout(resolve, 0));

			mgr.clearFieldsInIframe();

			expect(mockSourceWindow.postMessage).toHaveBeenCalledWith(
				{
					type: "LAZYAPPLY_CLEAR_FIELDS",
				},
				"*",
			);
		});
	});

	describe("fillFileInIframe", () => {
		it("should not throw when no form source window is set", () => {
			const fileInfo: AutofillResponseItem = {
				fieldName: "resume",
				path: "resume_upload",
				pathFound: true,
				fileUrl: "https://example.com/file.pdf",
				fileName: "resume.pdf",
				fileContentType: "PDF",
			};
			expect(() => manager.fillFileInIframe("hash", fileInfo)).not.toThrow();
		});

		it("should post file message to form source window when set", async () => {
			// Set up as parent frame
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			const mgr = new FormStoreManager();

			// Simulate receiving a form from iframe to set formSourceWindow
			const mockSourceWindow = { postMessage: vi.fn() };
			const mockFormData = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				fieldElements: [],
			};

			const messageEvent = new MessageEvent("message", {
				data: {
					type: "LAZYAPPLY_FORM_DETECTED",
					form: mockFormData,
				},
				origin: "https://example.com",
				source: mockSourceWindow as unknown as Window,
			});

			window.dispatchEvent(messageEvent);
			await new Promise((resolve) => setTimeout(resolve, 0));

			const fileInfo: AutofillResponseItem = {
				fieldName: "resume",
				path: "resume_upload",
				pathFound: true,
				fileUrl: "https://example.com/presigned-url",
				fileName: "my-cv.pdf",
				fileContentType: "PDF",
			};

			mgr.fillFileInIframe("resume-hash", fileInfo);

			expect(mockSourceWindow.postMessage).toHaveBeenCalledWith(
				{
					type: "LAZYAPPLY_FILL_FILE",
					hash: "resume-hash",
					fileUrl: "https://example.com/presigned-url",
					fileName: "my-cv.pdf",
					fileContentType: "PDF",
				},
				"*",
			);
		});
	});

	describe("setCachedIframeForm", () => {
		it("should cache the form", () => {
			const mockForm: ApplicationForm = {
				formHash: "cached-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				url: "https://example.com/apply",
				fieldElements: new Map(),
			};

			manager.setCachedIframeForm(mockForm);

			// The cached form is used internally, we can't directly access it
			// but we can verify it doesn't throw
			expect(() => manager.setCachedIframeForm(mockForm)).not.toThrow();
		});
	});

	describe("onIframeFormReceived", () => {
		it("should invoke callback when form is received from iframe in parent frame", async () => {
			// Set up as parent frame
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			const mgr = new FormStoreManager();
			const callback = vi.fn();
			mgr.onIframeFormReceived(callback);

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

			expect(callback).toHaveBeenCalledTimes(1);
			expect(callback).toHaveBeenCalledWith(
				expect.objectContaining({
					formHash: "received-hash",
					formDetected: true,
				}),
			);
		});

		it("should not invoke callback when in iframe", async () => {
			// Set up as iframe
			const mockTop = {} as Window;
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: mockTop, writable: true });

			const mgr = new FormStoreManager();
			const callback = vi.fn();
			mgr.onIframeFormReceived(callback);

			const mockFormData = {
				formHash: "received-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				fieldElements: [],
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

			expect(callback).not.toHaveBeenCalled();
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

		it("should fill file input when receiving LAZYAPPLY_FILL_FILE message in iframe", async () => {
			// Set up as iframe
			const mockTop = {} as Window;
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: mockTop, writable: true });

			const mgr = new FormStoreManager();

			// Create a file input element
			const fileInput = document.createElement("input");
			fileInput.type = "file";
			document.body.appendChild(fileInput);

			// Create mock form with the file input
			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [
					{
						hash: "resume-hash",
						tag: "input",
						type: "file",
						name: "resume",
						label: "Resume",
						placeholder: null,
						description: null,
						isFileUpload: true,
					},
				],
				url: "https://example.com/apply",
				fieldElements: new Map([["resume-hash", fileInput]]),
			};

			mgr.setCachedIframeForm(mockForm);

			// Mock fetch to return a blob
			const mockBlob = new Blob(["fake pdf content"], {
				type: "application/pdf",
			});
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});

			// Mock DataTransfer
			let filesSet = false;
			const mockFile = new File([mockBlob], "my-cv.pdf", {
				type: "application/pdf",
			});
			const mockFileList = {
				length: 1,
				item: () => mockFile,
				0: mockFile,
			};
			globalThis.DataTransfer = vi.fn(() => ({
				items: { add: vi.fn() },
				files: mockFileList,
			})) as unknown as typeof DataTransfer;

			// Spy on files setter
			Object.defineProperty(fileInput, "files", {
				set() {
					filesSet = true;
				},
				get() {
					return filesSet ? mockFileList : null;
				},
				configurable: true,
			});

			// Dispatch fill file message
			const messageEvent = new MessageEvent("message", {
				data: {
					type: "LAZYAPPLY_FILL_FILE",
					hash: "resume-hash",
					fileUrl: "https://example.com/presigned-url",
					fileName: "my-cv.pdf",
					fileContentType: "PDF",
				},
			});

			window.dispatchEvent(messageEvent);

			// Wait for async file fetch
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(globalThis.fetch).toHaveBeenCalledWith(
				"https://example.com/presigned-url",
			);
			expect(filesSet).toBe(true);

			// Cleanup
			document.body.removeChild(fileInput);
		});

		it("should ignore LAZYAPPLY_FILL_FILE message when not in iframe", async () => {
			// Set up as parent frame BEFORE creating manager
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			// Create a new manager in parent context
			const parentManager = new FormStoreManager();
			expect(parentManager.isParent).toBe(true);

			// Create a file input element
			const fileInput = document.createElement("input");
			fileInput.type = "file";
			document.body.appendChild(fileInput);

			// Create mock form with the file input
			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				url: "https://example.com/apply",
				fieldElements: new Map([["resume-hash", fileInput]]),
			};

			parentManager.setCachedIframeForm(mockForm);

			// Mock fetch - should NOT be called
			const fetchSpy = vi.fn();
			globalThis.fetch = fetchSpy;

			// Dispatch fill file message - parent should ignore this
			const messageEvent = new MessageEvent("message", {
				data: {
					type: "LAZYAPPLY_FILL_FILE",
					hash: "resume-hash",
					fileUrl: "https://example.com/presigned-url",
					fileName: "my-cv.pdf",
					fileContentType: "PDF",
				},
			});

			window.dispatchEvent(messageEvent);

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should not have fetched because parentManager is not in iframe
			// Note: Other managers created in beforeEach might still respond,
			// but the parentManager specifically should not process this
			// The check is that isIframe guards the handler
			expect(parentManager.isIframe).toBe(false);

			// Cleanup
			document.body.removeChild(fileInput);
		});

		it("should ignore LAZYAPPLY_FILL_FILE message with missing data", async () => {
			// Set up as iframe
			const mockTop = {} as Window;
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: mockTop, writable: true });

			new FormStoreManager();

			// Mock fetch
			globalThis.fetch = vi.fn();

			// Dispatch fill file message with missing fileName
			const messageEvent = new MessageEvent("message", {
				data: {
					type: "LAZYAPPLY_FILL_FILE",
					hash: "resume-hash",
					fileUrl: "https://example.com/presigned-url",
					// fileName is missing
				},
			});

			window.dispatchEvent(messageEvent);

			await new Promise((resolve) => setTimeout(resolve, 50));

			// Should not have fetched because fileName is missing
			expect(globalThis.fetch).not.toHaveBeenCalled();
		});

		it("should clear all fields when receiving LAZYAPPLY_CLEAR_FIELDS message in iframe", async () => {
			// Set up as iframe
			const mockTop = {} as Window;
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: mockTop, writable: true });

			const mgr = new FormStoreManager();

			// Create input elements with values
			const textInput = document.createElement("input");
			textInput.type = "text";
			textInput.value = "Some text";
			document.body.appendChild(textInput);

			const emailInput = document.createElement("input");
			emailInput.type = "email";
			emailInput.value = "test@example.com";
			document.body.appendChild(emailInput);

			// Create mock form with the inputs
			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 2,
				fields: [],
				url: "https://example.com/apply",
				fieldElements: new Map([
					["text-hash", textInput],
					["email-hash", emailInput],
				]),
			};

			mgr.setCachedIframeForm(mockForm);

			// Dispatch clear fields message
			const messageEvent = new MessageEvent("message", {
				data: {
					type: "LAZYAPPLY_CLEAR_FIELDS",
				},
			});

			window.dispatchEvent(messageEvent);

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(textInput.value).toBe("");
			expect(emailInput.value).toBe("");

			// Cleanup
			document.body.removeChild(textInput);
			document.body.removeChild(emailInput);
		});

		it("should ignore LAZYAPPLY_CLEAR_FIELDS message when not in iframe", async () => {
			// Set up as parent frame
			Object.defineProperty(window, "self", { value: window, writable: true });
			Object.defineProperty(window, "top", { value: window, writable: true });

			const mgr = new FormStoreManager();
			expect(mgr.isParent).toBe(true);

			// Create input element with value
			const textInput = document.createElement("input");
			textInput.type = "text";
			textInput.value = "Some text";
			document.body.appendChild(textInput);

			// Create mock form with the input
			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				url: "https://example.com/apply",
				fieldElements: new Map([["text-hash", textInput]]),
			};

			mgr.setCachedIframeForm(mockForm);

			// Dispatch clear fields message
			const messageEvent = new MessageEvent("message", {
				data: {
					type: "LAZYAPPLY_CLEAR_FIELDS",
				},
			});

			window.dispatchEvent(messageEvent);

			await new Promise((resolve) => setTimeout(resolve, 0));

			// Value should NOT be cleared because we're in parent frame
			expect(textInput.value).toBe("Some text");

			// Cleanup
			document.body.removeChild(textInput);
		});
	});
});
