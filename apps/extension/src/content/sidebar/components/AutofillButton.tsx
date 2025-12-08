import type { AutofillRequest, Field, FormInput } from "@lazyapply/types";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import { useCallback, useEffect, useState } from "react";
import { classifyFormFields } from "@/lib/api/api.js";
import { useUploads } from "@/lib/api/context/UploadsContext.js";
import { formStore } from "../../scanner/FormStoreManager.js";
import { detectApplicationForm } from "../../scanner/formDetector.js";

interface AutofillButtonProps {
	onError: (message: string) => void;
}

/**
 * Fill an element with a value (handles React compatibility)
 */
function fillElementWithValue(element: HTMLElement, value: string): void {
	const input = element as HTMLInputElement | HTMLTextAreaElement;

	// Use native setter for React compatibility
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

	// Dispatch events
	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function AutofillButton({ onError }: AutofillButtonProps) {
	const { hasUploads, selectedUpload } = useUploads();
	const [loading, setLoading] = useState(false);
	const [formDetected, setFormDetected] = useState<boolean | null>(null);

	// Function to check for forms (local + iframe)
	const checkForForms = useCallback(() => {
		// First check local document
		const localForm = detectApplicationForm();
		if (localForm && localForm.fields.length > 0) {
			setFormDetected(true);
			return;
		}

		// Check for form received from iframe
		const storedForm = formStore.getStoredForm();
		if (storedForm && storedForm.fields.length > 0) {
			setFormDetected(true);
			return;
		}

		// Request form from iframes (they'll respond via postMessage)
		formStore.requestFormFromIframes();
		setFormDetected(false);
	}, []);

	useEffect(() => {
		if (!hasUploads) return;
		checkForForms();

		// Listen for form updates from iframes
		const handleMessage = (event: MessageEvent) => {
			if (event.data?.type === "LAZYAPPLY_FORM_DETECTED") {
				setFormDetected(true);
			}
		};
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [hasUploads, checkForForms]);

	if (!hasUploads || !selectedUpload) {
		return null;
	}

	const handleAutofill = async () => {
		setLoading(true);

		try {
			// Try local form first, then stored form from iframe
			const localForm = detectApplicationForm();
			const applicationForm = localForm ?? formStore.getStoredForm();
			const isIframeForm = !localForm && !!applicationForm;

			if (!applicationForm || applicationForm.fields.length === 0) {
				setFormDetected(false);
				setLoading(false);
				return;
			}

			const fields: Field[] = applicationForm.fields.map((field) => ({
				hash: field.hash,
				field: {
					tag: field.tag,
					type: field.type,
					name: field.name,
					label: field.label,
					placeholder: field.placeholder,
					description: field.description,
					isFileUpload: field.isFileUpload,
					accept: field.accept ?? null,
				},
			}));

			const form: FormInput = {
				formHash: applicationForm.formHash,
				fields: fields.map((f) => ({ hash: f.hash })),
				pageUrl: window.location.href,
				action: applicationForm.formElement?.action ?? null,
			};

			const request: AutofillRequest = {
				form,
				fields,
				selectedUploadId: selectedUpload._id,
			};

			console.log("[AutofillButton] Sending autofill request:", request);

			const classifications = await classifyFormFields(request);

			console.log("[AutofillButton] Classification results:", classifications);

			// Fill form fields
			let filled = 0;
			let skipped = 0;

			for (const [hash, classification] of Object.entries(classifications)) {
				if (!classification.pathFound || !classification.value) {
					skipped++;
					continue;
				}

				if (isIframeForm) {
					// Fill via postMessage to iframe
					formStore.fillFieldInIframe(hash, classification.value);
					filled++;
				} else {
					// Fill directly in local document
					const element = applicationForm.fieldElements.get(hash);
					if (element) {
						fillElementWithValue(element, classification.value);
						filled++;
					} else {
						skipped++;
					}
				}
			}

			console.log(
				`[AutofillButton] Filled ${filled} fields, skipped ${skipped}`,
			);
		} catch (error) {
			console.error("[AutofillButton] Error:", error);
			onError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const isDisabled = loading || formDetected === false;

	return (
		<Stack direction="column" spacing={1}>
			<Divider orientation="horizontal" />
			{formDetected === false && (
				<Alert color="neutral" size="sm" variant="soft">
					No application form detected on this page
				</Alert>
			)}
			<Button
				fullWidth
				variant="outlined"
				color="primary"
				size="md"
				onClick={handleAutofill}
				loading={loading}
				disabled={isDisabled}
			>
				Autofill Application
			</Button>
		</Stack>
	);
}
