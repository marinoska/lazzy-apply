/**
 * Element Filling Utilities
 *
 * Low-level utilities for filling individual form elements with values.
 * Handles React-compatible value setting and various element types.
 */

/**
 * Set value on input/textarea and trigger React-compatible events
 */
function setInputValue(
	element: HTMLInputElement | HTMLTextAreaElement,
	value: string,
): void {
	element.focus();

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

	element.dispatchEvent(new Event("change", { bubbles: true }));
	element.blur();
}

/**
 * Dispatch input events to trigger form validation and React state updates
 */
function dispatchInputEvents(element: HTMLElement): void {
	element.focus();
	element.dispatchEvent(new Event("input", { bubbles: true }));
	element.dispatchEvent(new Event("change", { bubbles: true }));
	element.blur();
}

/**
 * Fill an input element with a value
 */
function fillInputElement(element: HTMLInputElement, value: string): boolean {
	const type = element.type.toLowerCase();

	// Skip file inputs - handled separately
	if (type === "file") {
		return false;
	}

	// Handle checkbox/radio
	if (type === "checkbox" || type === "radio") {
		const shouldCheck =
			value.toLowerCase() === "true" ||
			value === "1" ||
			value.toLowerCase() === "yes";
		element.checked = shouldCheck;
		dispatchInputEvents(element);
		return true;
	}

	setInputValue(element, value);
	return true;
}

/**
 * Fill a textarea element with a value
 */
function fillTextAreaElement(
	element: HTMLTextAreaElement,
	value: string,
): boolean {
	setInputValue(element, value);
	return true;
}

/**
 * Fill a select element with a value (tries exact match, then partial match)
 */
function fillSelectElement(element: HTMLSelectElement, value: string): boolean {
	const lowerValue = value.toLowerCase();

	// Try exact match
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
		`[ElementFilling] No matching option found for value: ${value} in select`,
	);
	return false;
}

/**
 * Fill a contenteditable element with a value
 */
function fillContentEditableElement(
	element: HTMLElement,
	value: string,
): boolean {
	element.textContent = value;
	dispatchInputEvents(element);
	return true;
}

/**
 * Fill a single form element with a value.
 * Handles input, textarea, select, and contenteditable elements.
 */
export function fillElement(element: HTMLElement, value: string): boolean {
	if (element instanceof HTMLInputElement) {
		return fillInputElement(element, value);
	}

	if (element instanceof HTMLTextAreaElement) {
		return fillTextAreaElement(element, value);
	}

	if (element instanceof HTMLSelectElement) {
		return fillSelectElement(element, value);
	}

	if (element.isContentEditable) {
		return fillContentEditableElement(element, value);
	}

	console.warn(`[ElementFilling] Unsupported element type: ${element.tagName}`);
	return false;
}

/**
 * Clear an element's value.
 * Skips file inputs and custom file upload widgets.
 */
export function clearElement(element: HTMLElement): void {
	// Skip custom file upload widgets
	if (element.hasAttribute("data-field")) {
		return;
	}

	// Only handle actual input/textarea elements
	if (
		!(element instanceof HTMLInputElement) &&
		!(element instanceof HTMLTextAreaElement)
	) {
		return;
	}

	// Skip file inputs - clearing them can trigger unwanted UI changes
	if (element.type === "file") {
		return;
	}

	const prototype =
		element instanceof HTMLTextAreaElement
			? HTMLTextAreaElement.prototype
			: HTMLInputElement.prototype;
	const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

	if (nativeSetter) {
		nativeSetter.call(element, "");
	} else {
		element.value = "";
	}

	element.dispatchEvent(new Event("input", { bubbles: true }));
	element.dispatchEvent(new Event("change", { bubbles: true }));
}
