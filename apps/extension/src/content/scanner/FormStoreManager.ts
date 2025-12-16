import type { AutofillResponseItem } from "@lazyapply/types";
import { type ApplicationForm, detectApplicationForm } from "./formDetector.js";

/**
 * Message types for cross-frame form communication
 */
const FORM_DETECTED_MESSAGE = "LAZYAPPLY_FORM_DETECTED";
const FORM_REQUEST_MESSAGE = "LAZYAPPLY_FORM_REQUEST";
const FILL_FIELD_MESSAGE = "LAZYAPPLY_FILL_FIELD";
const FILL_FILE_MESSAGE = "LAZYAPPLY_FILL_FILE";
const FILL_COVER_LETTER_FILE_MESSAGE = "LAZYAPPLY_FILL_COVER_LETTER_FILE";
const CLEAR_FIELDS_MESSAGE = "LAZYAPPLY_CLEAR_FIELDS";

/**
 * Stored form data with metadata
 */
interface StoredFormData {
	form: ApplicationForm;
	sourceOrigin: string;
	timestamp: number;
}

/**
 * Manages form detection and cross-frame communication for iframe-embedded forms.
 *
 * In parent frame: stores form data received from iframes, sends fill commands
 * In iframe: caches detected form, responds to requests, fills fields
 */
export class FormStoreManager {
	/** Whether this instance is running inside an iframe */
	readonly isIframe: boolean;

	/** Whether this instance is running in the parent frame */
	readonly isParent: boolean;

	/** Form data received from iframe (used in parent frame) */
	private storedFormData: StoredFormData | null = null;

	/** Reference to the iframe window that sent the form (used by parent for filling) */
	private formSourceWindow: Window | null = null;

	/** Cached form detected locally (used in iframe to avoid re-detection) */
	private cachedIframeForm: ApplicationForm | null = null;

	constructor() {
		this.isIframe = this.checkIsInIframe();
		this.isParent = !this.isIframe;
		this.initMessageListener();
	}

	/**
	 * Check if running inside an iframe
	 */
	private checkIsInIframe(): boolean {
		try {
			return window.self !== window.top;
		} catch {
			// Cross-origin iframe - we're definitely in an iframe
			return true;
		}
	}

	/**
	 * Set up message listener for cross-frame communication
	 */
	private initMessageListener(): void {
		window.addEventListener("message", (event) => this.handleMessage(event));
	}

	/**
	 * Broadcast form detection to parent window (called from iframe)
	 */
	broadcastFormToParent(form: ApplicationForm): void {
		if (this.isParent) return;

		const serializableForm = {
			...form,
			fieldElements: Array.from(form.fieldElements.keys()),
		};

		window.parent.postMessage(
			{
				type: FORM_DETECTED_MESSAGE,
				form: serializableForm,
			},
			"*",
		);
	}

	/**
	 * Request form data from iframes (called from parent)
	 */
	requestFormFromIframes(): void {
		if (this.isIframe) return;

		const iframes = document.querySelectorAll("iframe");
		for (const iframe of iframes) {
			try {
				iframe.contentWindow?.postMessage({ type: FORM_REQUEST_MESSAGE }, "*");
			} catch {
				// Cross-origin iframe - can't access contentWindow
			}
		}
	}

	/**
	 * Get stored form data received from iframe (for sidebar use)
	 */
	getStoredForm(): ApplicationForm | null {
		return this.storedFormData?.form ?? null;
	}

	/**
	 * Get the window reference for the form's iframe
	 */
	getFormSourceWindow(): Window | null {
		return this.formSourceWindow;
	}

	/**
	 * Cache the detected form (called after initial detection in iframe)
	 */
	setCachedIframeForm(form: ApplicationForm): void {
		this.cachedIframeForm = form;
	}

	/**
	 * Fill a field in the form's iframe context
	 */
	fillFieldInIframe(hash: string, value: string): void {
		if (!this.formSourceWindow) return;

		this.formSourceWindow.postMessage(
			{
				type: FILL_FIELD_MESSAGE,
				hash,
				value,
			},
			"*",
		);
	}

	/**
	 * Fill a file input in the form's iframe context
	 */
	fillFileInIframe(hash: string, fileInfo: AutofillResponseItem): void {
		if (!this.formSourceWindow) return;

		this.formSourceWindow.postMessage(
			{
				type: FILL_FILE_MESSAGE,
				hash,
				fileUrl: fileInfo.fileUrl,
				fileName: fileInfo.fileName,
				fileContentType: fileInfo.fileContentType,
			},
			"*",
		);
	}

	/**
	 * Clear all fields in the form's iframe context
	 */
	clearFieldsInIframe(): void {
		if (!this.formSourceWindow) return;

		this.formSourceWindow.postMessage(
			{
				type: CLEAR_FIELDS_MESSAGE,
			},
			"*",
		);
	}

	/**
	 * Fill a cover letter file input in the form's iframe context with a blob
	 */
	fillCoverLetterFileInIframe(
		hash: string,
		pdfBlob: Blob,
		fileName: string,
	): void {
		if (!this.formSourceWindow) return;

		// Convert blob to base64 for postMessage transfer
		const reader = new FileReader();
		reader.onload = () => {
			const base64Data = reader.result;
			this.formSourceWindow?.postMessage(
				{
					type: FILL_COVER_LETTER_FILE_MESSAGE,
					hash,
					base64Data,
					fileName,
				},
				"*",
			);
		};
		reader.readAsDataURL(pdfBlob);
	}

	/**
	 * Get cached form or detect it (for iframe context)
	 */
	private getOrDetectIframeForm(): ApplicationForm | null {
		if (!this.cachedIframeForm) {
			this.cachedIframeForm = detectApplicationForm();
		}
		return this.cachedIframeForm;
	}

	/**
	 * Handle incoming postMessage events
	 */
	private handleMessage(event: MessageEvent): void {
		const data = event.data;
		if (!data || typeof data !== "object") return;

		switch (data.type) {
			case FORM_DETECTED_MESSAGE:
				this.handleFormDetected(data, event);
				break;

			case FORM_REQUEST_MESSAGE:
				this.handleFormRequest();
				break;

			case FILL_FIELD_MESSAGE:
				this.handleFillField(data);
				break;

			case FILL_FILE_MESSAGE:
				this.handleFillFile(data);
				break;

			case FILL_COVER_LETTER_FILE_MESSAGE:
				this.handleFillCoverLetterFile(data);
				break;

			case CLEAR_FIELDS_MESSAGE:
				this.handleClearFields();
				break;
		}
	}

	/**
	 * Handle form detected message from iframe (parent receives)
	 */
	private handleFormDetected(
		data: { form?: ApplicationForm },
		event: MessageEvent,
	): void {
		if (!this.isParent || !data.form) return;

		this.storedFormData = {
			form: {
				...data.form,
				// Use parent page URL, not iframe URL
				url: location.href,
				fieldElements: new Map(),
			},
			sourceOrigin: event.origin,
			timestamp: Date.now(),
		};
		this.formSourceWindow = event.source as Window;

		console.log("[FormStore] Received form from iframe:", {
			formHash: this.storedFormData.form.formHash,
			fieldsCount: this.storedFormData.form.totalFields,
			iframeOrigin: event.origin,
			parentUrl: this.storedFormData.form.url,
		});
	}

	/**
	 * Handle form request from parent (iframe receives)
	 */
	private handleFormRequest(): void {
		if (!this.isIframe) return;

		const form = this.getOrDetectIframeForm();
		if (form) {
			this.broadcastFormToParent(form);
		}
	}

	/**
	 * Handle fill field request from parent (iframe receives)
	 */
	private handleFillField(data: { hash?: string; value?: string }): void {
		if (!this.isIframe || !data.hash || data.value === undefined) return;

		const form = this.getOrDetectIframeForm();
		if (!form) return;

		const element = form.fieldElements.get(data.hash);
		if (element) {
			this.fillElement(element, data.value);
		}
	}

	/**
	 * Handle fill file request from parent (iframe receives)
	 */
	private handleFillFile(data: {
		hash?: string;
		fileUrl?: string;
		fileName?: string;
		fileContentType?: string;
	}): void {
		if (!this.isIframe || !data.hash || !data.fileUrl || !data.fileName) return;

		const form = this.getOrDetectIframeForm();
		if (!form) return;

		const element = form.fieldElements.get(data.hash);
		if (element instanceof HTMLInputElement && element.type === "file") {
			this.fillFileElement(
				element,
				data.fileUrl,
				data.fileName,
				data.fileContentType,
			);
		}
	}

	/**
	 * Handle clear fields request from parent (iframe receives)
	 */
	private handleClearFields(): void {
		if (!this.isIframe) return;

		const form = this.getOrDetectIframeForm();
		if (!form) return;

		for (const element of form.fieldElements.values()) {
			this.clearElement(element);
		}
	}

	/**
	 * Handle fill cover letter file request from parent (iframe receives)
	 */
	private handleFillCoverLetterFile(data: {
		hash?: string;
		base64Data?: string;
		fileName?: string;
	}): void {
		if (!this.isIframe || !data.hash || !data.base64Data || !data.fileName)
			return;

		const form = this.getOrDetectIframeForm();
		if (!form) return;

		const element = form.fieldElements.get(data.hash);
		if (element instanceof HTMLInputElement && element.type === "file") {
			this.fillFileElementFromBase64(element, data.base64Data, data.fileName);
		}
	}

	/**
	 * Fill a file input element by fetching from URL
	 */
	private async fillFileElement(
		element: HTMLInputElement,
		fileUrl: string,
		fileName: string,
		fileContentType?: string,
	): Promise<void> {
		try {
			console.log(`[FormStore] Fetching file from: ${fileUrl}`);

			const response = await fetch(fileUrl);
			if (!response.ok) {
				console.error(
					`[FormStore] Failed to fetch file: ${response.status} ${response.statusText}`,
				);
				return;
			}

			const blob = await response.blob();
			const mimeType = this.getMimeType(fileContentType ?? "PDF");

			const file = new File([blob], fileName, { type: mimeType });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			element.files = dataTransfer.files;

			element.dispatchEvent(new Event("input", { bubbles: true }));
			element.dispatchEvent(new Event("change", { bubbles: true }));

			console.log(
				`[FormStore] Successfully set file: ${fileName} (${blob.size} bytes)`,
			);
		} catch (error) {
			console.error("[FormStore] Error filling file input:", error);
		}
	}

	/**
	 * Fill a file input element from base64 data
	 */
	private fillFileElementFromBase64(
		element: HTMLInputElement,
		base64Data: string,
		fileName: string,
	): void {
		try {
			// Convert base64 data URL to blob
			const [header, data] = base64Data.split(",");
			const mimeMatch = header.match(/data:([^;]+)/);
			const mimeType = mimeMatch ? mimeMatch[1] : "application/pdf";

			const binaryString = atob(data);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			const blob = new Blob([bytes], { type: mimeType });

			const file = new File([blob], fileName, { type: mimeType });
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			element.files = dataTransfer.files;

			element.dispatchEvent(new Event("input", { bubbles: true }));
			element.dispatchEvent(new Event("change", { bubbles: true }));

			console.log(
				`[FormStore] Successfully set cover letter file: ${fileName} (${blob.size} bytes)`,
			);
		} catch (error) {
			console.error(
				"[FormStore] Error filling cover letter file input:",
				error,
			);
		}
	}

	/**
	 * Map file content type to MIME type
	 */
	private getMimeType(fileContentType: string): string {
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
	 * Clear an element's value (handles React compatibility)
	 */
	private clearElement(element: HTMLElement): void {
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
	 * Fill an element with a value (handles React compatibility)
	 */
	private fillElement(element: HTMLElement, value: string): void {
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
}

/**
 * Singleton instance for use across the extension
 */
export const formStore = new FormStoreManager();
