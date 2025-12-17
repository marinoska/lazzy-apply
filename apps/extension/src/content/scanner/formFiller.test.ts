import type { AutofillResponse } from "@lazyapply/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fillFormFields } from "../sidebar/services/formFiller.js";
import type { ApplicationForm } from "./formDetector.js";

/**
 * Helper to create a minimal ApplicationForm for testing
 */
function createMockForm(
	fieldElements: Map<string, HTMLElement>,
): ApplicationForm {
	return {
		formHash: "test-hash",
		formDetected: true,
		totalFields: fieldElements.size,
		fields: [],
		url: "https://example.com/apply",
		fieldElements,
	};
}

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
				autofillId: "test-1",
				fromCache: false,
				fields: {
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
				},
			};

			const result = await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

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
				autofillId: "test-2",
				fromCache: false,
				fields: {
					"hash:summary": {
						fieldName: "summary",
						path: "summary",
						pathFound: true,
						value: "Experienced developer with 10 years of experience.",
					},
				},
			};

			const result = await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

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
				autofillId: "test-3",
				fromCache: false,
				fields: {
					"hash:city": {
						fieldName: "city",
						path: "personal.location",
						pathFound: true,
						value: null,
					},
				},
			};

			const result = await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

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
				autofillId: "test-4",
				fromCache: false,
				fields: {
					"hash:postcode": {
						fieldName: "postcode",
						path: "unknown",
						pathFound: false,
					},
				},
			};

			const result = await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

			expect(result.filled).toBe(0);
			expect(result.skipped).toBe(1);
		});

		it("should skip fields when element not found in map", async () => {
			const fieldElements = new Map<string, HTMLElement>();

			const autofillResponse: AutofillResponse = {
				autofillId: "test-5",
				fromCache: false,
				fields: {
					"hash:missing": {
						fieldName: "missing",
						path: "personal.email",
						pathFound: true,
						value: "test@example.com",
					},
				},
			};

			const result = await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

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
				autofillId: "test-6",
				fromCache: false,
				fields: {
					"hash:test": {
						fieldName: "test",
						path: "personal.fullName",
						pathFound: true,
						value: "Test Value",
					},
				},
			};

			await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

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
				autofillId: "test-7",
				fromCache: false,
				fields: {
					"hash:react": {
						fieldName: "react-input",
						path: "personal.fullName",
						pathFound: true,
						value: "React Value",
					},
				},
			};

			await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

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
				autofillId: "test-8",
				fromCache: false,
				fields: {
					"hash:resume": {
						fieldName: "resume",
						path: "resume_upload",
						pathFound: true,
						value: "somefile.pdf",
					},
				},
			};

			const result = await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

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
				autofillId: "test-9",
				fromCache: false,
				fields: {
					"hash:resume": {
						fieldName: "resume",
						path: "resume_upload",
						pathFound: true,
						fileUrl: "https://example.com/presigned-url",
						fileName: "my-cv.pdf",
						fileContentType: "PDF",
					},
				},
			};

			const result = await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

			expect(result.filled).toBe(1);
			expect(result.skipped).toBe(0);
			expect(filesSet).toBe(true);
			expect(setFileName).toBe("my-cv.pdf");
		});

		it("should fill custom file upload widget with existing hidden file input", async () => {
			container.innerHTML = `
				<div data-field="resume" data-file-types='["pdf","doc"]'>
					<span class="file-types">PDF, DOC</span>
					<input type="file" style="display:none" />
					<a data-source="attach">Attach</a>
				</div>
			`;

			const customWidget = container.querySelector(
				"[data-field='resume']",
			) as HTMLElement;
			const hiddenInput = customWidget.querySelector(
				"input[type='file']",
			) as HTMLInputElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:resume", customWidget],
			]);

			const mockBlob = new Blob(["fake pdf content"], {
				type: "application/pdf",
			});
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});

			let filesSet = false;
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

			globalThis.DataTransfer = vi.fn(() => ({
				items: { add: vi.fn() },
				files: mockFileList,
			})) as unknown as typeof DataTransfer;

			Object.defineProperty(hiddenInput, "files", {
				set(_value) {
					filesSet = true;
				},
				get() {
					return filesSet ? mockFileList : null;
				},
				configurable: true,
			});

			const autofillResponse: AutofillResponse = {
				autofillId: "test-custom-1",
				fromCache: false,
				fields: {
					"hash:resume": {
						fieldName: "resume",
						path: "resume_upload",
						pathFound: true,
						fileUrl: "https://example.com/presigned-url",
						fileName: "my-cv.pdf",
						fileContentType: "PDF",
					},
				},
			};

			const result = await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

			expect(result.filled).toBe(1);
			expect(filesSet).toBe(true);
		});

		it("should click attach button to create file input dynamically", async () => {
			container.innerHTML = `
				<div data-field="resume" data-file-types='["pdf","doc"]'>
					<span class="file-types">PDF, DOC</span>
					<a data-source="attach">Attach</a>
				</div>
			`;

			const customWidget = container.querySelector(
				"[data-field='resume']",
			) as HTMLElement;
			const attachButton = customWidget.querySelector(
				"[data-source='attach']",
			) as HTMLElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:resume", customWidget],
			]);

			const mockBlob = new Blob(["fake pdf content"], {
				type: "application/pdf",
			});
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});

			let filesSet = false;
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

			globalThis.DataTransfer = vi.fn(() => ({
				items: { add: vi.fn() },
				files: mockFileList,
			})) as unknown as typeof DataTransfer;

			// Simulate Greenhouse behavior: clicking attach creates a file input
			let attachClicked = false;
			attachButton.addEventListener("click", () => {
				attachClicked = true;
				const fileInput = document.createElement("input");
				fileInput.type = "file";
				Object.defineProperty(fileInput, "files", {
					set() {
						filesSet = true;
					},
					get() {
						return filesSet ? mockFileList : null;
					},
					configurable: true,
				});
				customWidget.appendChild(fileInput);
			});

			const autofillResponse: AutofillResponse = {
				autofillId: "test-custom-2",
				fromCache: false,
				fields: {
					"hash:resume": {
						fieldName: "resume",
						path: "resume_upload",
						pathFound: true,
						fileUrl: "https://example.com/presigned-url",
						fileName: "my-cv.pdf",
						fileContentType: "PDF",
					},
				},
			};

			const result = await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

			expect(attachClicked).toBe(true);
			expect(result.filled).toBe(1);
			expect(filesSet).toBe(true);
		});

		/**
		 * Greenhouse Resume Upload Widget Test
		 *
		 * This test simulates the exact Greenhouse behavior where:
		 * 1. The widget is a <div> with data-field="resume" (no file input initially)
		 * 2. Clicking "Attach" dynamically creates a hidden <input type="file">
		 * 3. The file input receives the file and dispatches change event
		 * 4. Greenhouse's JS listens to the change event and uploads the file
		 *
		 * The fix: Our code clicks the attach button, waits 100ms for the input
		 * to be created, then fills it programmatically.
		 */
		it("should handle Greenhouse resume widget with dynamically created file input", async () => {
			// Exact Greenhouse HTML structure
			container.innerHTML = `
				<div class="field attach-or-paste" data-field="resume" data-file-types='["pdf","doc","docx","txt","rtf"]'>
					<label id="resume-label">Resume/CV</label>
					<div class="drop-zone">
						<span class="drop-zone-text">Drag and drop</span>
						<span class="drop-zone-or">or</span>
						<a href="#" data-source="attach" class="attach-link">Attach</a>
						<span class="drop-zone-or">or</span>
						<a href="#" data-source="paste" class="paste-link">Paste</a>
					</div>
					<span class="file-types">PDF, DOC, DOCX, TXT, RTF</span>
					<!-- NOTE: No <input type="file"> exists initially! -->
				</div>
			`;

			const greenhouseWidget = container.querySelector(
				"[data-field='resume']",
			) as HTMLElement;
			const attachLink = greenhouseWidget.querySelector(
				"[data-source='attach']",
			) as HTMLElement;

			// Verify: no file input exists initially (this is the key issue)
			expect(greenhouseWidget.querySelector("input[type='file']")).toBeNull();

			const fieldElements = new Map<string, HTMLElement>([
				["hash:resume", greenhouseWidget],
			]);

			// Mock fetch to return CV file
			const cvContent = new Blob(["%PDF-1.4 fake cv content"], {
				type: "application/pdf",
			});
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(cvContent),
			});

			// Track file upload
			let fileWasSet = false;
			let uploadedFileName = "";
			let changeEventFired = false;

			const mockFile = new File([cvContent], "CV Marina Orlova 2025.pdf", {
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

			globalThis.DataTransfer = vi.fn(() => ({
				items: { add: vi.fn() },
				files: mockFileList,
			})) as unknown as typeof DataTransfer;

			// Simulate Greenhouse's JavaScript behavior:
			// When "Attach" is clicked, it creates a hidden file input
			let attachWasClicked = false;
			attachLink.addEventListener("click", (e) => {
				e.preventDefault();
				attachWasClicked = true;

				// Greenhouse creates the file input dynamically
				const fileInput = document.createElement("input");
				fileInput.type = "file";
				fileInput.accept = ".pdf,.doc,.docx,.txt,.rtf";
				fileInput.style.display = "none";
				fileInput.setAttribute("data-greenhouse-input", "true");

				// Track when files are set on the input
				Object.defineProperty(fileInput, "files", {
					set(value) {
						fileWasSet = true;
						if (value?.[0]) {
							uploadedFileName = value[0].name;
						}
					},
					get() {
						return fileWasSet ? mockFileList : null;
					},
					configurable: true,
				});

				// Track change event (Greenhouse listens to this)
				fileInput.addEventListener("change", () => {
					changeEventFired = true;
				});

				greenhouseWidget.appendChild(fileInput);
			});

			const autofillResponse: AutofillResponse = {
				autofillId: "greenhouse-resume-test",
				fromCache: false,
				fields: {
					"hash:resume": {
						fieldName: "resume",
						path: "resume_upload",
						pathFound: true,
						fileUrl: "https://r2.example.com/cv/user-123.pdf",
						fileName: "CV Marina Orlova 2025.pdf",
						fileContentType: "PDF",
					},
				},
			};

			const result = await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

			// Verify the fix worked:
			// 1. Attach button was clicked to create the file input
			expect(attachWasClicked).toBe(true);

			// 2. File input now exists (was created dynamically)
			const createdInput = greenhouseWidget.querySelector("input[type='file']");
			expect(createdInput).not.toBeNull();

			// 3. File was set on the input
			expect(fileWasSet).toBe(true);
			expect(uploadedFileName).toBe("CV Marina Orlova 2025.pdf");

			// 4. Change event was fired (Greenhouse needs this to upload)
			expect(changeEventFired).toBe(true);

			// 5. Fill was successful
			expect(result.filled).toBe(1);
			expect(result.skipped).toBe(0);
		});

		it("should fall back to drag-drop when no file input available", async () => {
			container.innerHTML = `
				<div data-field="resume" data-file-types='["pdf","doc"]'>
					<div class="drop-zone">Drop files here</div>
				</div>
			`;

			const customWidget = container.querySelector(
				"[data-field='resume']",
			) as HTMLElement;
			const dropZone = customWidget.querySelector(".drop-zone") as HTMLElement;

			const fieldElements = new Map<string, HTMLElement>([
				["hash:resume", customWidget],
			]);

			const mockBlob = new Blob(["fake pdf content"], {
				type: "application/pdf",
			});
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				blob: () => Promise.resolve(mockBlob),
			});

			const mockFile = new File([mockBlob], "my-cv.pdf", {
				type: "application/pdf",
			});

			globalThis.DataTransfer = vi.fn(() => ({
				items: { add: vi.fn() },
				files: { length: 1, 0: mockFile },
			})) as unknown as typeof DataTransfer;

			// Mock DragEvent (not available in jsdom)
			globalThis.DragEvent = class DragEvent extends Event {
				dataTransfer: DataTransfer | null;
				constructor(type: string, init?: DragEventInit) {
					super(type, init);
					this.dataTransfer = init?.dataTransfer ?? null;
				}
			} as unknown as typeof DragEvent;

			let dropEventReceived = false;
			dropZone.addEventListener("drop", () => {
				dropEventReceived = true;
			});

			const autofillResponse: AutofillResponse = {
				autofillId: "test-custom-3",
				fromCache: false,
				fields: {
					"hash:resume": {
						fieldName: "resume",
						path: "resume_upload",
						pathFound: true,
						fileUrl: "https://example.com/presigned-url",
						fileName: "my-cv.pdf",
						fileContentType: "PDF",
					},
				},
			};

			await fillFormFields(
				createMockForm(fieldElements),
				autofillResponse,
				false,
			);

			expect(dropEventReceived).toBe(true);
		});
	});
});
