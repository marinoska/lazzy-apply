/**
 * File Upload Detection
 *
 * Utilities for detecting and locating file upload elements in custom ATS widgets.
 *
 * Problem: Greenhouse and similar ATS platforms don't have a <input type="file">
 * in the DOM initially. The file input is created dynamically only when the user
 * clicks the "Attach" button.
 *
 * Solution: Click the attach button programmatically to trigger the dynamic
 * creation of the file input, wait for it to appear, then fill it.
 */

/**
 * Selectors for attach/upload buttons across different ATS platforms.
 * Add new selectors here when supporting additional platforms.
 */
export const ATTACH_BUTTON_SELECTORS = [
	// Greenhouse
	'[data-source="attach"]',
	".attach-link",
	// Lever
	'[data-qa="upload-button"]',
	".upload-btn",
	// Workday
	'[data-automation-id="file-upload-input-ref"]',
	// Generic patterns (more specific first)
	'[aria-label*="attach" i]',
	'[aria-label*="upload" i]',
	'button[class*="attach" i]',
	'button[class*="upload" i]',
	'a[class*="attach" i]',
	'a[class*="upload" i]',
];

/**
 * Find attach/upload button within a container using platform-specific selectors
 */
export function findAttachButton(container: HTMLElement): HTMLElement | null {
	for (const selector of ATTACH_BUTTON_SELECTORS) {
		const button = container.querySelector<HTMLElement>(selector);
		if (button) return button;
	}
	return null;
}

/**
 * Find existing file input or create one by clicking the attach button.
 *
 * Strategy:
 * 1. Look for existing file input inside/near the container
 * 2. Click attach button → wait 100ms → find newly created input (THE FIX)
 */
export async function findOrCreateFileInput(
	container: HTMLElement,
): Promise<HTMLInputElement | null> {
	// Strategy 1: Find existing file input
	const existingInput =
		container.querySelector<HTMLInputElement>('input[type="file"]') ??
		container.parentElement?.querySelector<HTMLInputElement>(
			'input[type="file"]',
		);

	if (existingInput) return existingInput;

	// Strategy 2: Click attach button to create file input dynamically
	const attachButton = findAttachButton(container);
	if (!attachButton) return null;

	console.log("[FileUpload] Clicking attach button to create file input");
	attachButton.click();
	await new Promise((resolve) => setTimeout(resolve, 100));

	// Search within the field scope (fieldset/.field) to avoid targeting wrong field
	const fieldScope =
		container.closest("fieldset, .field") ?? container.parentElement;
	return (
		container.querySelector<HTMLInputElement>('input[type="file"]') ??
		container.parentElement?.querySelector<HTMLInputElement>(
			'input[type="file"]',
		) ??
		fieldScope?.querySelector<HTMLInputElement>('input[type="file"]') ??
		// Greenhouse-specific: find file input in S3 upload form by field name
		findGreenhouseFileInput(container) ??
		null
	);
}

/**
 * Greenhouse-specific: Find file input in S3 upload form by field name.
 * Greenhouse uses separate S3 upload forms with data-presigned-form attribute
 * that matches the data-field attribute on the upload widget.
 */
export function findGreenhouseFileInput(
	container: HTMLElement,
): HTMLInputElement | null {
	const fieldName = container.getAttribute("data-field");
	if (!fieldName) return null;

	const s3Form = document.querySelector(`[data-presigned-form="${fieldName}"]`);
	if (!s3Form) return null;

	const fileInput =
		s3Form.querySelector<HTMLInputElement>('input[type="file"]');
	if (fileInput) {
		console.log(
			`[FileUpload] Found Greenhouse S3 file input for field: ${fieldName}`,
		);
	}
	return fileInput;
}
