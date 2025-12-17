import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formStore } from "./FormStoreManager.js";
import type { ApplicationForm } from "./formDetector.js";
import { clearFormFields } from "./formFiller.js";

vi.mock("../../scanner/FormStoreManager.js", () => ({
	formStore: {
		clearFieldsInIframe: vi.fn(),
	},
}));

describe("formFiller", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		vi.clearAllMocks();
	});

	afterEach(() => {
		container.remove();
	});

	describe("clearFormFields", () => {
		it("should clear text input fields", () => {
			container.innerHTML = `
				<input type="text" id="firstname" name="firstname" value="John" />
				<input type="email" id="email" name="email" value="john@example.com" />
			`;

			const firstnameInput = container.querySelector(
				"#firstname",
			) as HTMLInputElement;
			const emailInput = container.querySelector("#email") as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:firstname", firstnameInput],
				["hash:email", emailInput],
			]);

			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 2,
				fields: [],
				url: "https://example.com/apply",
				fieldElements,
			};

			clearFormFields(mockForm, false);

			expect(firstnameInput.value).toBe("");
			expect(emailInput.value).toBe("");
		});

		it("should clear textarea fields", () => {
			container.innerHTML = `<textarea id="summary" name="summary">Some text content</textarea>`;

			const summaryTextarea = container.querySelector(
				"#summary",
			) as HTMLTextAreaElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:summary", summaryTextarea],
			]);

			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				url: "https://example.com/apply",
				fieldElements,
			};

			clearFormFields(mockForm, false);

			expect(summaryTextarea.value).toBe("");
		});

		it("should skip file input fields to avoid triggering site UI changes", () => {
			// Some sites hide upload buttons when file inputs are cleared and change events fire.
			// We skip clearing file inputs - they will be overwritten when filled.
			container.innerHTML = `<input type="file" id="resume" name="resume" />`;

			const fileInput = container.querySelector("#resume") as HTMLInputElement;

			// Track if change event was dispatched (it shouldn't be for file inputs)
			let changeEventFired = false;
			fileInput.addEventListener("change", () => {
				changeEventFired = true;
			});

			const fieldElements = new Map<string, HTMLElement>([
				["hash:resume", fileInput],
			]);

			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				url: "https://example.com/apply",
				fieldElements,
			};

			clearFormFields(mockForm, false);

			// File input should NOT be cleared and no events should fire
			expect(changeEventFired).toBe(false);
		});

		it("should dispatch input and change events when clearing", () => {
			container.innerHTML = `<input type="text" id="test" name="test" value="Test Value" />`;

			const testInput = container.querySelector("#test") as HTMLInputElement;

			const inputEvents: Event[] = [];
			const changeEvents: Event[] = [];

			testInput.addEventListener("input", (e) => inputEvents.push(e));
			testInput.addEventListener("change", (e) => changeEvents.push(e));

			const fieldElements = new Map<string, HTMLElement>([
				["hash:test", testInput],
			]);

			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				url: "https://example.com/apply",
				fieldElements,
			};

			clearFormFields(mockForm, false);

			expect(inputEvents.length).toBe(1);
			expect(changeEvents.length).toBe(1);
			expect(testInput.value).toBe("");
		});

		it("should call clearFieldsInIframe for iframe forms", () => {
			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				url: "https://example.com/apply",
				fieldElements: new Map(),
			};

			clearFormFields(mockForm, true);

			expect(formStore.clearFieldsInIframe).toHaveBeenCalled();
		});

		it("should not call clearFieldsInIframe for non-iframe forms", () => {
			container.innerHTML = `<input type="text" id="test" name="test" value="Test" />`;

			const testInput = container.querySelector("#test") as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:test", testInput],
			]);

			const mockForm: ApplicationForm = {
				formHash: "test-hash",
				formDetected: true,
				totalFields: 1,
				fields: [],
				url: "https://example.com/apply",
				fieldElements,
			};

			clearFormFields(mockForm, false);

			expect(formStore.clearFieldsInIframe).not.toHaveBeenCalled();
		});
	});
});
