/**
 * Form Filler (Scanner)
 *
 * Low-level form filling module used by the scanner for direct DOM manipulation.
 * Works with raw field element maps without iframe or ApplicationForm abstractions.
 *
 * Responsibilities:
 * - Fill individual form elements (input, textarea, select, contenteditable)
 * - Handle React-compatible value setting via native setters
 * - Dispatch proper input/change events for framework compatibility
 * - Fill file inputs by fetching from presigned URLs
 * - Coordinate file uploads (filled last to avoid blocking from CV parsing)
 *
 * @see ../sidebar/services/formFiller.ts for the higher-level sidebar version
 */
import type { AutofillResponse, AutofillResponseItem } from "@lazyapply/types";

/**
 * Set value on input/textarea and trigger React-compatible events
 */
function setInputValue(
	element: HTMLInputElement | HTMLTextAreaElement,
	value: string,
): void {
	// Focus first
	element.focus();

	// Get the native value setter
	const prototype =
		element instanceof HTMLInputElement
			? HTMLInputElement.prototype
			: HTMLTextAreaElement.prototype;
	const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

	if (nativeSetter) {
		nativeSetter.call(element, value);
	}

	// Dispatch InputEvent which React 16+ listens to
	element.dispatchEvent(
		new InputEvent("input", {
			bubbles: true,
			cancelable: true,
			inputType: "insertText",
			data: value,
		}),
	);

	// Also dispatch change event
	element.dispatchEvent(new Event("change", { bubbles: true }));

	// Blur to trigger validation
	element.blur();
}

export type FillFormFieldsResult = {
	filled: number;
	skipped: number;
	pendingFileUploads: number;
};

/**
 * Fill form fields with values from the autofill response
 * File inputs are filled asynchronously - the returned pendingFileUploads count
 * indicates how many file uploads are in progress
 * @returns Number of fields successfully filled and pending file uploads
 */
export async function fillFormFields(
	autofillResponse: AutofillResponse,
	fieldElements: Map<string, HTMLElement>,
): Promise<FillFormFieldsResult> {
	let filled = 0;
	let skipped = 0;

	// Collect file fields to fill them last
	const fileFields: Array<{
		hash: string;
		element: HTMLInputElement;
		item: AutofillResponseItem;
	}> = [];

	// First pass: fill all non-file fields
	for (const [hash, item] of Object.entries(autofillResponse.fields)) {
		const element = fieldElements.get(hash);
		if (!element) {
			console.warn(`[FormFiller] Element not found for hash: ${hash}`);
			skipped++;
			continue;
		}

		// Collect file inputs with resume_upload path for second pass
		if (
			element instanceof HTMLInputElement &&
			element.type === "file" &&
			item.path === "resume_upload" &&
			item.fileUrl
		) {
			fileFields.push({ hash, element, item });
			continue;
		}

		// Skip fields without values or where path wasn't found in CV data
		if (!item.pathFound || item.value == null) {
			console.log(
				`[FormFiller] Skipping field ${item.fieldName ?? hash}: pathFound=${item.pathFound}, hasValue=${item.value != null}`,
			);
			skipped++;
			continue;
		}

		const success = fillElement(element, item.value);
		if (success) {
			filled++;
			console.log(
				`[FormFiller] Filled ${item.fieldName ?? hash} with path ${item.path}`,
			);
		} else {
			skipped++;
			console.warn(`[FormFiller] Failed to fill ${item.fieldName ?? hash}`);
		}
	}

	// Second pass: fill file fields last
	// Some sites parse CVs automatically and block the page once parsing starts,
	// so we fill file inputs after all other fields are populated
	const fileUploadPromises: Promise<boolean>[] = [];

	for (const { hash, element, item } of fileFields) {
		console.log(
			`[FormFiller] Queueing file upload for ${item.fieldName ?? hash}`,
		);
		fileUploadPromises.push(
			fillFileInput(element, item).then((success) => {
				if (success) {
					console.log(
						`[FormFiller] File uploaded for ${item.fieldName ?? hash}`,
					);
				} else {
					console.warn(
						`[FormFiller] Failed to upload file for ${item.fieldName ?? hash}`,
					);
				}
				return success;
			}),
		);
	}

	// Wait for all file uploads to complete
	if (fileUploadPromises.length > 0) {
		const results = await Promise.all(fileUploadPromises);
		const successfulUploads = results.filter(Boolean).length;
		filled += successfulUploads;
		skipped += results.length - successfulUploads;
	}

	return { filled, skipped, pendingFileUploads: fileUploadPromises.length };
}

/**
 * Fill a single form element with a value
 */
function fillElement(element: HTMLElement, value: string): boolean {
	if (element instanceof HTMLInputElement) {
		return fillInputElement(element, value);
	}

	if (element instanceof HTMLTextAreaElement) {
		return fillTextAreaElement(element, value);
	}

	if (element instanceof HTMLSelectElement) {
		return fillSelectElement(element, value);
	}

	// Try contenteditable elements
	if (element.isContentEditable) {
		return fillContentEditableElement(element, value);
	}

	console.warn(`[FormFiller] Unsupported element type: ${element.tagName}`);
	return false;
}

function fillInputElement(element: HTMLInputElement, value: string): boolean {
	const type = element.type.toLowerCase();

	// Skip file inputs - they are handled separately via fillFileInput
	if (type === "file") {
		console.log(
			"[FormFiller] Skipping file input in fillInputElement - handled separately",
		);
		return false;
	}

	// Handle checkbox/radio differently
	if (type === "checkbox" || type === "radio") {
		const shouldCheck =
			value.toLowerCase() === "true" ||
			value === "1" ||
			value.toLowerCase() === "yes";
		element.checked = shouldCheck;
		dispatchInputEvents(element);
		return true;
	}

	// Standard text-like inputs - use setInputValue for React compatibility
	setInputValue(element, value);
	return true;
}

function fillTextAreaElement(
	element: HTMLTextAreaElement,
	value: string,
): boolean {
	setInputValue(element, value);
	return true;
}

function fillSelectElement(element: HTMLSelectElement, value: string): boolean {
	// Try to find matching option by value or text
	const lowerValue = value.toLowerCase();

	for (const option of element.options) {
		if (
			option.value.toLowerCase() === lowerValue ||
			option.text.toLowerCase() === lowerValue
		) {
			element.value = option.value;
			dispatchInputEvents(element);
			return true;
		}
	}

	// Try partial match
	for (const option of element.options) {
		if (
			option.value.toLowerCase().includes(lowerValue) ||
			option.text.toLowerCase().includes(lowerValue)
		) {
			element.value = option.value;
			dispatchInputEvents(element);
			return true;
		}
	}

	console.warn(
		`[FormFiller] No matching option found for value: ${value} in select`,
	);
	return false;
}

function fillContentEditableElement(
	element: HTMLElement,
	value: string,
): boolean {
	element.textContent = value;
	dispatchInputEvents(element);
	return true;
}

/**
 * Dispatch input events to trigger form validation and React state updates
 */
function dispatchInputEvents(element: HTMLElement): void {
	// Focus the element first
	element.focus();

	// Dispatch events that frameworks typically listen to
	element.dispatchEvent(new Event("input", { bubbles: true }));
	element.dispatchEvent(new Event("change", { bubbles: true }));

	// Blur to trigger validation
	element.blur();
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

		// Fetch the file from the presigned URL
		const response = await fetch(item.fileUrl);
		if (!response.ok) {
			console.error(
				`[FormFiller] Failed to fetch file: ${response.status} ${response.statusText}`,
			);
			return false;
		}

		const blob = await response.blob();
		const mimeType = getMimeType(item.fileContentType ?? "PDF");

		// Create a File object from the blob
		const file = new File([blob], item.fileName, { type: mimeType });

		// Create a DataTransfer to set the file on the input
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(file);
		element.files = dataTransfer.files;

		// Dispatch events to notify the form of the change
		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));

		console.log(
			`[FormFiller] Successfully set file: ${item.fileName} (${blob.size} bytes)`,
		);
		return true;
	} catch (error) {
		console.error("[FormFiller] Error filling file input:", error);
		return false;
	}
}
