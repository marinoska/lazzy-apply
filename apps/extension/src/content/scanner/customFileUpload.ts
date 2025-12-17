/**
 * Custom File Upload Detection
 *
 * Some ATS platforms (e.g., Greenhouse, Lever) use custom file upload widgets
 * instead of standard <input type="file"> elements. These widgets typically:
 *
 * 1. Use a container element (div) with data-field attribute indicating the field name
 *    Example: <div data-field="resume" data-file-types='["pdf","doc"]'>
 *
 * 2. May include:
 *    - data-file-types: JSON array of accepted extensions
 *    - .file-types: Element showing accepted file types to user
 *    - .drop-zone: Drag-and-drop area
 *    - [data-source='attach']: Button to trigger file picker
 *
 * 3. Often hide the actual <input type="file"> or create it dynamically when
 *    the user clicks "Attach"
 *
 * Detection: This module identifies these widgets by looking for elements with
 * data-field attributes containing file upload keywords (resume, cv, cover_letter).
 *
 * Filling Strategy (in FormStoreManager/formFiller):
 * 1. Look for existing <input type="file"> inside/near the container
 * 2. If not found, click the attach button ([data-source="attach"], .attach, button, a)
 *    to trigger dynamic creation of the file input
 * 3. Wait 100ms for the input to appear, then fill it
 * 4. Fall back to drag-drop simulation if nothing else works
 *
 * @see FormStoreManager.fillCustomFileUpload
 * @see formFiller.fillCustomFileUpload
 */

import type { FormField } from "./formDetector.js";

const FILE_UPLOAD_KEYWORDS = ["resume", "cv", "cover_letter", "coverletter"];

/**
 * Checks if an element with data-field looks like a file upload container.
 */
function isFileUploadContainer(el: Element, dataField: string): boolean {
	return (
		FILE_UPLOAD_KEYWORDS.some((k) => dataField.includes(k)) ||
		el.hasAttribute("data-file-types") ||
		el.querySelector(".file-types, .drop-zone, [data-source='attach']") !== null
	);
}

/**
 * Parses data-file-types JSON array into accept string.
 * Example: '["pdf","doc"]' -> ".pdf,.doc"
 */
function parseFileTypes(el: Element): string | null {
	const raw = el.getAttribute("data-file-types");
	if (!raw) return null;

	try {
		const types = JSON.parse(raw) as unknown;
		if (Array.isArray(types)) {
			return types.map((t) => `.${t}`).join(",");
		}
	} catch {
		// Invalid JSON
	}
	return null;
}

/**
 * Finds label text for a custom file upload element.
 */
function findLabel(el: Element, dataField: string): string | null {
	// Try id-based label (e.g., "resume-label")
	const labelEl = document.getElementById(`${dataField}-label`);
	if (labelEl?.textContent?.trim()) {
		return labelEl.textContent.trim();
	}

	// Try .file-types as description fallback for label context
	const fileTypesEl = el.querySelector(".file-types");
	if (fileTypesEl?.previousElementSibling?.textContent?.trim()) {
		return fileTypesEl.previousElementSibling.textContent.trim();
	}

	// Fallback: humanize data-field ("cover_letter" -> "Cover Letter")
	return dataField.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Finds description text for a custom file upload element.
 */
function findDescription(el: Element): string | null {
	const ariaDescribedBy = el.getAttribute("aria-describedby");
	if (ariaDescribedBy) {
		const descEl = document.getElementById(ariaDescribedBy);
		if (descEl?.textContent?.trim()) {
			return descEl.textContent.trim();
		}
	}

	const fileTypesEl = el.querySelector(".file-types");
	return fileTypesEl?.textContent?.trim() ?? null;
}

export interface CustomFileUploadResult {
	element: HTMLElement;
	field: Partial<FormField>;
}

/**
 * Finds custom file upload containers (e.g., Greenhouse's data-field widgets)
 * that aren't standard <input type="file"> elements.
 */
export function findCustomFileUploads(
	container: Element,
	existingFieldNames: Set<string>,
): CustomFileUploadResult[] {
	const results: CustomFileUploadResult[] = [];

	for (const el of container.querySelectorAll("[data-field]")) {
		const dataField = el.getAttribute("data-field")?.toLowerCase();
		if (!dataField || existingFieldNames.has(dataField)) continue;
		if (!isFileUploadContainer(el, dataField)) continue;

		results.push({
			element: el as HTMLElement,
			field: {
				tag: "div",
				type: "file",
				isFileUpload: true,
				name: dataField,
				label: findLabel(el, dataField),
				placeholder: null,
				description: findDescription(el),
				accept: parseFileTypes(el),
			},
		});
	}

	return results;
}
