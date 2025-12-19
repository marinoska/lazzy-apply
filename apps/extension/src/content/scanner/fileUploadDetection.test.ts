import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ATTACH_BUTTON_SELECTORS,
	findAttachButton,
	findGreenhouseFileInput,
	findOrCreateFileInput,
} from "./fileUploadDetection.js";

describe("fileUploadDetection", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	describe("findAttachButton", () => {
		it("should find Greenhouse attach button with data-source attribute", () => {
			container.innerHTML = '<button data-source="attach">Attach</button>';
			const button = findAttachButton(container);
			expect(button).not.toBeNull();
			expect(button?.getAttribute("data-source")).toBe("attach");
		});

		it("should find button with attach-link class", () => {
			container.innerHTML = '<a class="attach-link">Attach</a>';
			const button = findAttachButton(container);
			expect(button).not.toBeNull();
			expect(button?.classList.contains("attach-link")).toBe(true);
		});

		it("should find Lever upload button", () => {
			container.innerHTML = '<button data-qa="upload-button">Upload</button>';
			const button = findAttachButton(container);
			expect(button).not.toBeNull();
		});

		it("should find button with aria-label containing attach", () => {
			container.innerHTML = '<button aria-label="Attach file">+</button>';
			const button = findAttachButton(container);
			expect(button).not.toBeNull();
		});

		it("should return null when no attach button found", () => {
			container.innerHTML = "<button>Submit</button>";
			const button = findAttachButton(container);
			expect(button).toBeNull();
		});

		it("should return first matching button when multiple exist", () => {
			container.innerHTML = `
				<button data-source="attach">First</button>
				<button class="attach-link">Second</button>
			`;
			const button = findAttachButton(container);
			expect(button?.textContent).toBe("First");
		});
	});

	describe("findGreenhouseFileInput", () => {
		it("should find file input in S3 upload form matching data-field attribute", () => {
			container.setAttribute("data-field", "resume");
			const s3Form = document.createElement("div");
			s3Form.setAttribute("data-presigned-form", "resume");
			s3Form.innerHTML = '<input type="file" name="file">';
			document.body.appendChild(s3Form);

			const fileInput = findGreenhouseFileInput(container);

			expect(fileInput).not.toBeNull();
			expect(fileInput?.type).toBe("file");
		});

		it("should return null when container has no data-field attribute", () => {
			const fileInput = findGreenhouseFileInput(container);
			expect(fileInput).toBeNull();
		});

		it("should return null when no matching S3 form exists", () => {
			container.setAttribute("data-field", "resume");
			const fileInput = findGreenhouseFileInput(container);
			expect(fileInput).toBeNull();
		});

		it("should return null when S3 form has no file input", () => {
			container.setAttribute("data-field", "resume");
			const s3Form = document.createElement("div");
			s3Form.setAttribute("data-presigned-form", "resume");
			document.body.appendChild(s3Form);

			const fileInput = findGreenhouseFileInput(container);
			expect(fileInput).toBeNull();
		});

		it("should find correct file input when multiple S3 forms exist", () => {
			container.setAttribute("data-field", "cover_letter");

			const resumeForm = document.createElement("div");
			resumeForm.setAttribute("data-presigned-form", "resume");
			resumeForm.innerHTML =
				'<input type="file" name="file" id="resume-input">';
			document.body.appendChild(resumeForm);

			const coverLetterForm = document.createElement("div");
			coverLetterForm.setAttribute("data-presigned-form", "cover_letter");
			coverLetterForm.innerHTML =
				'<input type="file" name="file" id="cover-letter-input">';
			document.body.appendChild(coverLetterForm);

			const fileInput = findGreenhouseFileInput(container);

			expect(fileInput).not.toBeNull();
			expect(fileInput?.id).toBe("cover-letter-input");
		});
	});

	describe("findOrCreateFileInput", () => {
		it("should return existing file input inside container", async () => {
			container.innerHTML = '<input type="file" id="existing">';
			const fileInput = await findOrCreateFileInput(container);
			expect(fileInput?.id).toBe("existing");
		});

		it("should return existing file input in parent element", async () => {
			const parent = document.createElement("div");
			parent.innerHTML = '<input type="file" id="parent-input">';
			parent.appendChild(container);
			document.body.appendChild(parent);

			const fileInput = await findOrCreateFileInput(container);
			expect(fileInput?.id).toBe("parent-input");
		});

		it("should click attach button and find created file input", async () => {
			const attachButton = document.createElement("button");
			attachButton.setAttribute("data-source", "attach");
			attachButton.addEventListener("click", () => {
				container.innerHTML += '<input type="file" id="dynamic">';
			});
			container.appendChild(attachButton);

			const fileInput = await findOrCreateFileInput(container);
			expect(fileInput?.id).toBe("dynamic");
		});

		it("should return null when no attach button and no file input", async () => {
			const fileInput = await findOrCreateFileInput(container);
			expect(fileInput).toBeNull();
		});

		it("should use Greenhouse fallback when file input is in S3 form", async () => {
			container.setAttribute("data-field", "resume");
			const attachButton = document.createElement("button");
			attachButton.setAttribute("data-source", "attach");
			container.appendChild(attachButton);

			const s3Form = document.createElement("div");
			s3Form.setAttribute("data-presigned-form", "resume");
			s3Form.innerHTML = '<input type="file" name="file" id="s3-input">';
			document.body.appendChild(s3Form);

			const fileInput = await findOrCreateFileInput(container);
			expect(fileInput?.id).toBe("s3-input");
		});
	});

	describe("ATTACH_BUTTON_SELECTORS", () => {
		it("should include Greenhouse selectors", () => {
			expect(ATTACH_BUTTON_SELECTORS).toContain('[data-source="attach"]');
			expect(ATTACH_BUTTON_SELECTORS).toContain(".attach-link");
		});

		it("should include Lever selectors", () => {
			expect(ATTACH_BUTTON_SELECTORS).toContain('[data-qa="upload-button"]');
		});

		it("should include Workday selectors", () => {
			expect(ATTACH_BUTTON_SELECTORS).toContain(
				'[data-automation-id="file-upload-input-ref"]',
			);
		});
	});
});
