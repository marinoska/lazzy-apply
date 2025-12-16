import type { AutofillResponse, AutofillResponseItem } from "@lazyapply/types";
import { formStore } from "../../scanner/FormStoreManager.js";
import type { ApplicationForm } from "../../scanner/formDetector.js";

/**
 * Fill an element with a value (handles React compatibility)
 */
export function fillElementWithValue(
	element: HTMLElement,
	value: string,
): void {
	const input = element as HTMLInputElement | HTMLTextAreaElement;

	const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
		window.HTMLInputElement.prototype,
		"value",
	)?.set;
	const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
		window.HTMLTextAreaElement.prototype,
		"value",
	)?.set;

	const setter =
		input.tagName === "TEXTAREA"
			? nativeTextAreaValueSetter
			: nativeInputValueSetter;

	if (setter) {
		setter.call(input, value);
	} else {
		input.value = value;
	}

	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Map file content type to MIME type
 */
function getMimeType(fileContentType: string): string {
	switch (fileContentType) {
		case "PDF":
			return "application/pdf";
		case "DOCX":
			return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
		default:
			return "application/octet-stream";
	}
}

/**
 * Fill a file input by fetching the file from a presigned URL
 */
async function fillFileInput(
	element: HTMLInputElement,
	item: AutofillResponseItem,
): Promise<boolean> {
	if (!item.fileUrl || !item.fileName) {
		console.warn("[FormFiller] Missing fileUrl or fileName for file input");
		return false;
	}

	try {
		console.log(`[FormFiller] Fetching file from: ${item.fileUrl}`);

		const response = await fetch(item.fileUrl);
		if (!response.ok) {
			console.error(
				`[FormFiller] Failed to fetch file: ${response.status} ${response.statusText}`,
			);
			return false;
		}

		const blob = await response.blob();
		const mimeType = getMimeType(item.fileContentType ?? "PDF");

		const file = new File([blob], item.fileName, { type: mimeType });

		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(file);
		element.files = dataTransfer.files;

		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));

		console.log(
			`[FormFiller] Successfully set file: ${item.fileName} (${blob.size} bytes)`,
		);
		return true;
	} catch (err) {
		console.error("[FormFiller] Error filling file input:", err);
		return false;
	}
}

export interface FillResult {
	filled: number;
	skipped: number;
}

/**
 * Clear all form fields before filling
 */
export function clearFormFields(
	applicationForm: ApplicationForm,
	isIframeForm: boolean,
): void {
	if (isIframeForm) {
		formStore.clearFieldsInIframe();
		return;
	}

	for (const element of applicationForm.fieldElements.values()) {
		clearElement(element);
	}
}

/**
 * Clear an element's value (handles React compatibility)
 */
function clearElement(element: HTMLElement): void {
	const input = element as HTMLInputElement | HTMLTextAreaElement;

	if (input.type === "file") {
		(input as HTMLInputElement).value = "";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
		return;
	}

	const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
		window.HTMLInputElement.prototype,
		"value",
	)?.set;
	const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
		window.HTMLTextAreaElement.prototype,
		"value",
	)?.set;

	const setter =
		input.tagName === "TEXTAREA"
			? nativeTextAreaValueSetter
			: nativeInputValueSetter;

	if (setter) {
		setter.call(input, "");
	} else {
		input.value = "";
	}

	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Fill form fields with classification results
 */
export async function fillFormFields(
	applicationForm: ApplicationForm,
	classifications: AutofillResponse,
	isIframeForm: boolean,
): Promise<FillResult> {
	let filled = 0;
	let skipped = 0;
	const fileUploadPromises: Promise<boolean>[] = [];

	for (const [hash, classification] of Object.entries(classifications.fields)) {
		const element = applicationForm.fieldElements.get(hash);

		if (classification.path === "resume_upload" && classification.fileUrl) {
			console.log(
				`[FormFiller] Queueing file upload for ${classification.fieldName ?? hash}`,
			);
			if (isIframeForm) {
				formStore.fillFileInIframe(hash, classification);
				filled++;
			} else if (
				element instanceof HTMLInputElement &&
				element.type === "file"
			) {
				fileUploadPromises.push(
					fillFileInput(element, classification).then((success) => {
						if (success) {
							console.log(
								`[FormFiller] File uploaded for ${classification.fieldName ?? hash}`,
							);
						} else {
							console.warn(
								`[FormFiller] Failed to upload file for ${classification.fieldName ?? hash}`,
							);
						}
						return success;
					}),
				);
			} else {
				console.warn(`[FormFiller] Element for ${hash} is not a file input`);
				skipped++;
			}
			continue;
		}

		if (!classification.pathFound || !classification.value) {
			skipped++;
			continue;
		}

		if (isIframeForm) {
			formStore.fillFieldInIframe(hash, classification.value);
			filled++;
		} else {
			if (element) {
				fillElementWithValue(element, classification.value);
				filled++;
			} else {
				skipped++;
			}
		}
	}

	if (fileUploadPromises.length > 0) {
		const results = await Promise.all(fileUploadPromises);
		const successfulUploads = results.filter(Boolean).length;
		filled += successfulUploads;
		skipped += results.length - successfulUploads;
	}

	return { filled, skipped };
}
