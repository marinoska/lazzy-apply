import { type ApplicationForm, detectApplicationForm } from "./formDetector.js";

/**
 * Message types for cross-frame form communication
 */
const FORM_DETECTED_MESSAGE = "LAZYAPPLY_FORM_DETECTED";
const FORM_REQUEST_MESSAGE = "LAZYAPPLY_FORM_REQUEST";
const FILL_FIELD_MESSAGE = "LAZYAPPLY_FILL_FIELD";

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
				fieldElements: new Map(),
			},
			sourceOrigin: event.origin,
			timestamp: Date.now(),
		};
		this.formSourceWindow = event.source as Window;

		console.log(
			"[FormStore] Received form from iframe:",
			this.storedFormData.form.formHash,
		);
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
