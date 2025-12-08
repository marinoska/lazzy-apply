import type { AutofillResponse } from "@lazyapply/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
		it("should fill text input fields with values", async () => {
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
					fieldName: "firstname",
					path: "personal.fullName",
					pathFound: true,
					value: "John Doe",
				},
				"hash:email": {
					fieldName: "email",
					path: "personal.email",
					pathFound: true,
					value: "john@example.com",
				},
			};

			const result = await fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(2);
			expect(result.skipped).toBe(0);
			expect(firstnameInput.value).toBe("John Doe");
			expect(emailInput.value).toBe("john@example.com");
		});

		it("should fill textarea fields with values", async () => {
			container.innerHTML = `<textarea id="summary" name="summary"></textarea>`;

			const summaryTextarea = container.querySelector(
				"#summary",
			) as HTMLTextAreaElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:summary", summaryTextarea],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:summary": {
					fieldName: "summary",
					path: "summary",
					pathFound: true,
					value: "Experienced developer with 10 years of experience.",
				},
			};

			const result = await fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(1);
			expect(summaryTextarea.value).toBe(
				"Experienced developer with 10 years of experience.",
			);
		});

		it("should skip fields without values", async () => {
			container.innerHTML = `<input type="text" id="city" name="city" />`;

			const cityInput = container.querySelector("#city") as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:city", cityInput],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:city": {
					fieldName: "city",
					path: "personal.location",
					pathFound: true,
					value: null,
				},
			};

			const result = await fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(0);
			expect(result.skipped).toBe(1);
			expect(cityInput.value).toBe("");
		});

		it("should skip fields where pathFound is false", async () => {
			container.innerHTML = `<input type="text" id="postcode" name="postcode" />`;

			const postcodeInput = container.querySelector(
				"#postcode",
			) as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:postcode", postcodeInput],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:postcode": {
					fieldName: "postcode",
					path: "unknown",
					pathFound: false,
				},
			};

			const result = await fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(0);
			expect(result.skipped).toBe(1);
		});

		it("should skip fields when element not found in map", async () => {
			const fieldElements = new Map<string, HTMLElement>();

			const autofillResponse: AutofillResponse = {
				"hash:missing": {
					fieldName: "missing",
					path: "personal.email",
					pathFound: true,
					value: "test@example.com",
				},
			};

			const result = await fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(0);
			expect(result.skipped).toBe(1);
		});

		it("should dispatch input and change events when filling", async () => {
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
					fieldName: "test",
					path: "personal.fullName",
					pathFound: true,
					value: "Test Value",
				},
			};

			await fillFormFields(autofillResponse, fieldElements);

			expect(inputEvents.length).toBe(1);
			expect(changeEvents.length).toBe(1);
			expect((inputEvents[0] as InputEvent).inputType).toBe("insertText");
			expect((inputEvents[0] as InputEvent).data).toBe("Test Value");
		});

		it("should use native value setter for React compatibility", async () => {
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
					fieldName: "react-input",
					path: "personal.fullName",
					pathFound: true,
					value: "React Value",
				},
			};

			await fillFormFields(autofillResponse, fieldElements);

			// Restore original setter
			Object.defineProperty(HTMLInputElement.prototype, "value", {
				set: nativeSetter,
				configurable: true,
			});

			// Verify native setter was called with correct value
			expect(nativeSetterCalled).toBe(true);
			expect(nativeSetterValue).toBe("React Value");
		});

		it("should skip file inputs without fileUrl", async () => {
			container.innerHTML = `<input type="file" id="resume" name="resume" />`;

			const fileInput = container.querySelector("#resume") as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:resume", fileInput],
			]);

			const autofillResponse: AutofillResponse = {
				"hash:resume": {
					fieldName: "resume",
					path: "resume_upload",
					pathFound: true,
					value: "somefile.pdf",
				},
			};

			const result = await fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(0);
			expect(result.skipped).toBe(1);
		});

		it("should fill file inputs with fileUrl", async () => {
			container.innerHTML = `<input type="file" id="resume" name="resume" accept=".pdf,.docx" />`;

			const fileInput = container.querySelector("#resume") as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:resume", fileInput],
			]);

			// Mock fetch to return a fake PDF blob
			const mockBlob = new Blob(["fake pdf content"], {
				type: "application/pdf",
			});
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});

			// Track if files property was set (jsdom doesn't support DataTransfer properly)
			let filesSet = false;
			let setFileName = "";
			const mockFile = new File([mockBlob], "my-cv.pdf", {
				type: "application/pdf",
			});
			const mockFileList = {
				length: 1,
				item: () => mockFile,
				0: mockFile,
				[Symbol.iterator]: function* () {
					yield mockFile;
				},
			};

			// Mock DataTransfer
			globalThis.DataTransfer = vi.fn(() => ({
				items: { add: vi.fn() },
				files: mockFileList,
			})) as unknown as typeof DataTransfer;

			// Spy on files setter
			Object.defineProperty(fileInput, "files", {
				set(value) {
					filesSet = true;
					if (value?.[0]) {
						setFileName = value[0].name;
					}
				},
				get() {
					return filesSet ? mockFileList : null;
				},
				configurable: true,
			});

			const autofillResponse: AutofillResponse = {
				"hash:resume": {
					fieldName: "resume",
					path: "resume_upload",
					pathFound: true,
					fileUrl: "https://example.com/presigned-url",
					fileName: "my-cv.pdf",
					fileContentType: "PDF",
				},
			};

			const result = await fillFormFields(autofillResponse, fieldElements);

			expect(result.filled).toBe(1);
			expect(result.skipped).toBe(0);
			expect(result.pendingFileUploads).toBe(1);
			expect(filesSet).toBe(true);
			expect(setFileName).toBe("my-cv.pdf");
		});
	});
});
