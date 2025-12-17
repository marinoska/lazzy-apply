/**
 * Form Filler Service
 *
 * High-level form filling service used by the sidebar/autofill context.
 * Handles both direct DOM manipulation and iframe communication via FormStoreManager.
 *
 * Responsibilities:
 * - Fill form fields with autofill classification results
 * - Handle iframe forms by delegating to FormStoreManager
 * - Clear form fields before filling
 * - Coordinate file uploads (filled last to avoid blocking from CV parsing)
 */
import type { AutofillResponse, AutofillResponseItem } from "@lazyapply/types";
import { clearElement, fillElement } from "../../scanner/elementFilling.js";
import { formStore } from "../../scanner/FormStoreManager.js";
import { fillFileUpload } from "../../scanner/fileUploadFilling.js";
import type { ApplicationForm } from "../../scanner/formDetector.js";

export interface FillResult {
	filled: number;
	skipped: number;
}

/**
 * Clear all form fields before filling.
 *
 * Note: File inputs are intentionally skipped during clearing.
 * Some sites (e.g., Lever, Greenhouse) hide upload buttons when file inputs
 * are cleared and change events fire. File inputs will be overwritten when filled.
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
 * Fill form fields with classification results
 */
export async function fillFormFields(
	applicationForm: ApplicationForm,
	classifications: AutofillResponse,
	isIframeForm: boolean,
): Promise<FillResult> {
	let filled = 0;
	let skipped = 0;

	// Collect file fields to fill them last
	const fileFields: Array<{
		hash: string;
		classification: AutofillResponseItem;
	}> = [];

	// First pass: fill all non-file fields
	for (const [hash, classification] of Object.entries(classifications.fields)) {
		const element = applicationForm.fieldElements.get(hash);

		if (classification.path === "resume_upload" && classification.fileUrl) {
			fileFields.push({ hash, classification });
			continue;
		}

		if (!classification.pathFound || !classification.value) {
			skipped++;
			continue;
		}

		if (isIframeForm) {
			formStore.fillFieldInIframe(hash, classification.value);
			filled++;
		} else if (element) {
			const success = fillElement(element, classification.value);
			if (success) {
				filled++;
			} else {
				skipped++;
			}
		} else {
			skipped++;
		}
	}

	// Second pass: fill file fields last
	// Some sites parse CVs automatically and block the page once parsing starts,
	// so we fill file inputs after all other fields are populated
	const fileUploadPromises: Promise<boolean>[] = [];

	for (const { hash, classification } of fileFields) {
		const element = applicationForm.fieldElements.get(hash);

		console.log(
			`[FormFiller] Queueing file upload for ${classification.fieldName ?? hash}`,
		);

		if (isIframeForm) {
			formStore.fillFileInIframe(hash, classification);
			filled++;
		} else if (element) {
			// Handle both standard file inputs and custom file upload widgets
			const isStandardFileInput =
				element instanceof HTMLInputElement && element.type === "file";
			const isCustomFileUpload = element.hasAttribute("data-field");

			if (isStandardFileInput || isCustomFileUpload) {
				if (!classification.fileUrl || !classification.fileName) continue;

				fileUploadPromises.push(
					fillFileUpload(
						element,
						classification.fileUrl,
						classification.fileName,
						classification.fileContentType,
					).then((success) => {
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
				console.warn(`[FormFiller] Element for ${hash} is not a file upload`);
				skipped++;
			}
		} else {
			console.warn(`[FormFiller] Element for ${hash} not found`);
			skipped++;
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
