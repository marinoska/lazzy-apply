import type { AutofillResponse } from "@lazyapply/types";

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

/**
 * Fill form fields with values from the autofill response
 * @returns Number of fields successfully filled
 */
export function fillFormFields(
	autofillResponse: AutofillResponse,
	fieldElements: Map<string, HTMLElement>,
): { filled: number; skipped: number } {
	let filled = 0;
	let skipped = 0;

	for (const [hash, item] of Object.entries(autofillResponse)) {
		const element = fieldElements.get(hash);
		if (!element) {
			console.warn(`[FormFiller] Element not found for hash: ${hash}`);
			skipped++;
			continue;
		}

		// Skip fields without values or where path wasn't found in CV data
		if (!item.pathFound || item.value == null) {
			console.log(
				`[FormFiller] Skipping field ${item.fieldId}: pathFound=${item.pathFound}, hasValue=${item.value != null}`,
			);
			skipped++;
			continue;
		}

		const success = fillElement(element, item.value);
		if (success) {
			filled++;
			console.log(`[FormFiller] Filled ${item.fieldId} with path ${item.path}`);
		} else {
			skipped++;
			console.warn(`[FormFiller] Failed to fill ${item.fieldId}`);
		}
	}

	return { filled, skipped };
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

	// Skip file inputs - they require special handling
	if (type === "file") {
		console.log("[FormFiller] Skipping file input - requires manual upload");
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
