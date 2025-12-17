/**
 * File Upload Filling
 *
 * Utilities for filling file upload elements with files from presigned URLs.
 * Handles both standard file inputs and custom ATS widgets.
 */

import { findOrCreateFileInput } from "./fileUploadDetection.js";

/**
 * Map file content type to MIME type
 */
export function getMimeType(fileContentType: string): string {
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
 * Set file value on an input element and dispatch events
 */
export function setFileInputValue(input: HTMLInputElement, file: File): void {
	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);
	input.files = dataTransfer.files;
	input.setAttribute("data-filled", "true");
	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Simulate drag-and-drop file upload on a container element
 */
export function simulateFileDrop(container: HTMLElement, file: File): void {
	const dropZone = container.querySelector(".drop-zone") ?? container;
	const dataTransfer = new DataTransfer();
	dataTransfer.items.add(file);

	const dropEvent = new DragEvent("drop", {
		bubbles: true,
		cancelable: true,
		dataTransfer,
	});
	dropZone.dispatchEvent(dropEvent);
}

/**
 * Fetch file from presigned URL and create File object
 */
export async function fetchFileFromUrl(
	fileUrl: string,
	fileName: string,
	fileContentType?: string,
): Promise<File | null> {
	console.log(`[FileUpload] Fetching file from: ${fileUrl}`);

	const response = await fetch(fileUrl);
	if (!response.ok) {
		console.error(
			`[FileUpload] Failed to fetch file: ${response.status} ${response.statusText}`,
		);
		return null;
	}

	const blob = await response.blob();
	const mimeType = getMimeType(fileContentType ?? "PDF");

	return new File([blob], fileName, { type: mimeType });
}

/**
 * Fill a standard input[type=file] element
 */
export async function fillStandardFileInput(
	element: HTMLInputElement,
	fileUrl: string,
	fileName: string,
	fileContentType?: string,
): Promise<boolean> {
	try {
		const file = await fetchFileFromUrl(fileUrl, fileName, fileContentType);
		if (!file) return false;

		setFileInputValue(element, file);
		console.log(
			`[FileUpload] Successfully set file: ${fileName} (${file.size} bytes)`,
		);
		return true;
	} catch (error) {
		console.error("[FileUpload] Error filling file input:", error);
		return false;
	}
}

/**
 * Fill a custom file upload widget (e.g., Greenhouse's data-field containers)
 */
export async function fillCustomFileUpload(
	element: HTMLElement,
	fileUrl: string,
	fileName: string,
	fileContentType?: string,
): Promise<boolean> {
	try {
		const file = await fetchFileFromUrl(fileUrl, fileName, fileContentType);
		if (!file) return false;

		const fileInput = await findOrCreateFileInput(element);
		if (fileInput) {
			setFileInputValue(fileInput, file);
			console.log(
				`[FileUpload] Filled file input in custom widget: ${fileName}`,
			);
			return true;
		}

		// Fallback: Simulate drag-and-drop on the container
		simulateFileDrop(element, file);
		console.log(`[FileUpload] Simulated drop on custom widget: ${fileName}`);
		return true;
	} catch (error) {
		console.error("[FileUpload] Error filling custom file upload:", error);
		return false;
	}
}

/**
 * Fill a file upload element (standard input or custom widget)
 */
export async function fillFileUpload(
	element: HTMLElement,
	fileUrl: string,
	fileName: string,
	fileContentType?: string,
): Promise<boolean> {
	if (!fileUrl || !fileName) {
		console.warn("[FileUpload] Missing fileUrl or fileName for file upload");
		return false;
	}

	// Standard file input
	if (element instanceof HTMLInputElement && element.type === "file") {
		return fillStandardFileInput(element, fileUrl, fileName, fileContentType);
	}

	// Custom file upload widget (e.g., Greenhouse data-field container)
	if (element.hasAttribute("data-field")) {
		return fillCustomFileUpload(element, fileUrl, fileName, fileContentType);
	}

	console.warn("[FileUpload] Unknown file upload element type");
	return false;
}
