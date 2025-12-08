import type {
	AutofillRequest,
	AutofillResponseItem,
	Field,
	FormInput,
} from "@lazyapply/types";
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
		console.warn("[AutofillButton] Missing fileUrl or fileName for file input");
		return false;
	}

	try {
		console.log(`[AutofillButton] Fetching file from: ${item.fileUrl}`);

		// Fetch the file from the presigned URL
		const response = await fetch(item.fileUrl);
		if (!response.ok) {
			console.error(
				`[AutofillButton] Failed to fetch file: ${response.status} ${response.statusText}`,
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
			`[AutofillButton] Successfully set file: ${item.fileName} (${blob.size} bytes)`,
		);
		return true;
	} catch (error) {
		console.error("[AutofillButton] Error filling file input:", error);
		return false;
	}
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
			const fileUploadPromises: Promise<boolean>[] = [];

			for (const [hash, classification] of Object.entries(classifications)) {
				const element = applicationForm.fieldElements.get(hash);

				// Handle file inputs with resume_upload path
				if (classification.path === "resume_upload" && classification.fileUrl) {
					console.log(
						`[AutofillButton] Queueing file upload for ${classification.fieldName ?? hash}`,
					);
					if (isIframeForm) {
						// Send file info to iframe for it to handle the upload
						formStore.fillFileInIframe(hash, classification);
						filled++;
					} else if (
						element instanceof HTMLInputElement &&
						element.type === "file"
					) {
						// For local forms with file input element
						fileUploadPromises.push(
							fillFileInput(element, classification).then((success) => {
								if (success) {
									console.log(
										`[AutofillButton] File uploaded for ${classification.fieldName ?? hash}`,
									);
								} else {
									console.warn(
										`[AutofillButton] Failed to upload file for ${classification.fieldName ?? hash}`,
									);
								}
								return success;
							}),
						);
					} else {
						console.warn(
							`[AutofillButton] Element for ${hash} is not a file input`,
						);
						skipped++;
					}
					continue;
				}

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
					if (element) {
						fillElementWithValue(element, classification.value);
						filled++;
					} else {
						skipped++;
					}
				}
			}

			// Wait for all file uploads to complete
			if (fileUploadPromises.length > 0) {
				const results = await Promise.all(fileUploadPromises);
				const successfulUploads = results.filter(Boolean).length;
				filled += successfulUploads;
				skipped += results.length - successfulUploads;
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
