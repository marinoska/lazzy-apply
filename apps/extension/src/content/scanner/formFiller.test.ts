import type { AutofillResponse } from "@lazyapply/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fillFormFields } from "./formFiller.js";

describe("formFiller", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	describe("fillFormFields", () => {
		it("should fill text input fields with values", () => {
			container.innerHTML = `
				<input type="text" id="firstname" name="firstname" />
				<input type="email" id="email" name="email" />
			`;

			const firstnameInput = container.querySelector(
				"#firstname",
			) as HTMLInputElement;
			const emailInput = container.querySelector("#email") as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:firstname", firstnameInput],
				["hash:email", emailInput],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:firstname": {
					fieldId: "firstname",
					fieldName: "firstname",
					path: "personal.fullName",
					pathFound: true,
					value: "John Doe",
				},
				"hash:email": {
					fieldId: "email",
					fieldName: "email",
					path: "personal.email",
					pathFound: true,
					value: "john@example.com",
				},
			};

			const result = fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(2);
			expect(result.skipped).toBe(0);
			expect(firstnameInput.value).toBe("John Doe");
			expect(emailInput.value).toBe("john@example.com");
		});

		it("should fill textarea fields with values", () => {
			container.innerHTML = `<textarea id="summary" name="summary"></textarea>`;

			const summaryTextarea = container.querySelector(
				"#summary",
			) as HTMLTextAreaElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:summary", summaryTextarea],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:summary": {
					fieldId: "summary",
					fieldName: "summary",
					path: "summary",
					pathFound: true,
					value: "Experienced developer with 10 years of experience.",
				},
			};

			const result = fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(1);
			expect(summaryTextarea.value).toBe(
				"Experienced developer with 10 years of experience.",
			);
		});

		it("should skip fields without values", () => {
			container.innerHTML = `<input type="text" id="city" name="city" />`;

			const cityInput = container.querySelector("#city") as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:city", cityInput],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:city": {
					fieldId: "city",
					fieldName: "city",
					path: "personal.location",
					pathFound: true,
					value: null,
				},
			};

			const result = fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(0);
			expect(result.skipped).toBe(1);
			expect(cityInput.value).toBe("");
		});

		it("should skip fields where pathFound is false", () => {
			container.innerHTML = `<input type="text" id="postcode" name="postcode" />`;

			const postcodeInput = container.querySelector(
				"#postcode",
			) as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:postcode", postcodeInput],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:postcode": {
					fieldId: "postcode",
					fieldName: "postcode",
					path: "unknown",
					pathFound: false,
				},
			};

			const result = fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(0);
			expect(result.skipped).toBe(1);
		});

		it("should skip fields when element not found in map", () => {
			const fieldElements = new Map<string, HTMLElement>();

			const autofillResponse: AutofillResponse = {
				"hash:missing": {
					fieldId: "missing",
					fieldName: "missing",
					path: "personal.email",
					pathFound: true,
					value: "test@example.com",
				},
			};

			const result = fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(0);
			expect(result.skipped).toBe(1);
		});

		it("should dispatch input and change events when filling", () => {
			container.innerHTML = `<input type="text" id="test" name="test" />`;

			const testInput = container.querySelector("#test") as HTMLInputElement;

			const inputEvents: Event[] = [];
			const changeEvents: Event[] = [];

			testInput.addEventListener("input", (e) => inputEvents.push(e));
			testInput.addEventListener("change", (e) => changeEvents.push(e));

			const fieldElements = new Map<string, HTMLElement>([
				["hash:test", testInput],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:test": {
					fieldId: "test",
					fieldName: "test",
					path: "personal.fullName",
					pathFound: true,
					value: "Test Value",
				},
			};

			fillFormFields(autofillResponse, fieldElements);

			expect(inputEvents.length).toBe(1);
			expect(changeEvents.length).toBe(1);
			expect((inputEvents[0] as InputEvent).inputType).toBe("insertText");
			expect((inputEvents[0] as InputEvent).data).toBe("Test Value");
		});

		it("should use native value setter for React compatibility", () => {
			container.innerHTML = `<input type="text" id="react-input" name="react-input" />`;

			const reactInput = container.querySelector(
				"#react-input",
			) as HTMLInputElement;

			// Track if native setter was called by checking the underlying value
			const nativeSetter = Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			)?.set;

			let nativeSetterCalled = false;
			let nativeSetterValue = "";

			// Spy on the native setter
			Object.defineProperty(HTMLInputElement.prototype, "value", {
				set(v: string) {
					nativeSetterCalled = true;
					nativeSetterValue = v;
					nativeSetter?.call(this, v);
				},
				get() {
					return Object.getOwnPropertyDescriptor(
						HTMLInputElement.prototype,
						"value",
					)?.get?.call(this);
				},
				configurable: true,
			});

			const fieldElements = new Map<string, HTMLElement>([
				["hash:react", reactInput],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:react": {
					fieldId: "react-input",
					fieldName: "react-input",
					path: "personal.fullName",
					pathFound: true,
					value: "React Value",
				},
			};

			fillFormFields(autofillResponse, fieldElements);

			// Restore original setter
			Object.defineProperty(HTMLInputElement.prototype, "value", {
				set: nativeSetter,
				configurable: true,
			});

			// Verify native setter was called with correct value
			expect(nativeSetterCalled).toBe(true);
			expect(nativeSetterValue).toBe("React Value");
		});

		it("should skip file inputs", () => {
			container.innerHTML = `<input type="file" id="resume" name="resume" />`;

			const fileInput = container.querySelector("#resume") as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:resume", fileInput],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:resume": {
					fieldId: "resume",
					fieldName: "resume",
					path: "resume_upload",
					pathFound: true,
					value: "somefile.pdf",
				},
			};

			const result = fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(0);
			expect(result.skipped).toBe(1);
		});
	});
});
