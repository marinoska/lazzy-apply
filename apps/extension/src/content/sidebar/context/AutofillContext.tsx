import type {
	AutofillRequest,
	AutofillResponse,
	Field,
	FormContextBlock,
	FormInput,
} from "@lazyapply/types";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { classifyFormFields } from "@/lib/api/api.js";
import { getLastDetectedJD } from "@/lib/api/backgroundClient.js";
import { useUploads } from "@/lib/api/context/UploadsContext.js";
import { formStore } from "../../scanner/FormStoreManager.js";
import { detectApplicationForm } from "../../scanner/formDetector.js";
import { clearFormFields, fillFormFields } from "../../scanner/formFiller.js";
import { extractTextBlocks } from "../../scanner/textBlocksExtractor.js";

interface AutofillContextValue {
	/** Whether a form was detected on the page */
	formDetected: boolean | null;
	/** Whether autofill is in progress */
	isLoading: boolean;
	/** Classification results from the API */
	classifications: AutofillResponse | null;
	/** Whether a cover letter field was detected */
	hasCoverLetterField: boolean;
	/** Run autofill on the detected form */
	runAutofill: () => Promise<void>;
	/** Error message if autofill failed */
	error: string | null;
	/** Clear the error */
	clearError: () => void;
}

const AutofillContext = createContext<AutofillContextValue | null>(null);

interface AutofillProviderProps {
	children: React.ReactNode;
}

export function AutofillProvider({ children }: AutofillProviderProps) {
	const { hasUploads, selectedUpload } = useUploads();
	const [formDetected, setFormDetected] = useState<boolean | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [classifications, setClassifications] =
		useState<AutofillResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [autofillId, setAutofillId] = useState<string | null>(null);

	// Check for forms on mount and when uploads change
	const checkForForms = useCallback(() => {
		const localForm = detectApplicationForm();
		if (localForm && localForm.fields.length > 0) {
			setFormDetected(true);
			return;
		}

		const storedForm = formStore.getStoredForm();
		if (storedForm && storedForm.fields.length > 0) {
			setFormDetected(true);
			return;
		}

		formStore.requestFormFromIframes();
		setFormDetected(false);
	}, []);

	useEffect(() => {
		if (!hasUploads) return;
		checkForForms();

		const handleMessage = (event: MessageEvent) => {
			if (event.data?.type === "LAZYAPPLY_FORM_DETECTED") {
				setFormDetected(true);
			}
		};
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [hasUploads, checkForForms]);

	const runAutofill = useCallback(async () => {
		if (!selectedUpload) return;

		setIsLoading(true);
		setError(null);

		try {
			const localForm = detectApplicationForm();
			const applicationForm = localForm ?? formStore.getStoredForm();
			const isIframeForm = !localForm && !!applicationForm;

			if (!applicationForm || applicationForm.fields.length === 0) {
				setFormDetected(false);
				return;
			}

			// Clear all form fields before filling
			clearFormFields(applicationForm, isIframeForm);

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
				pageUrl: applicationForm.url,
				action: applicationForm.formElement?.action ?? null,
			};

			// Fetch stored JD from background script
			const storedJD = await getLastDetectedJD();
			const jdRawText =
				storedJD?.blocks
					?.map((block) => (block as { text?: string }).text ?? "")
					.join("\n") ?? "";

			// Extract text blocks from the current page for form context
			const formContext: FormContextBlock[] = extractTextBlocks();

			const request: AutofillRequest = {
				form,
				fields,
				selectedUploadId: selectedUpload._id,
				jdRawText,
				jdUrl: storedJD?.url,
				formContext,
				...(autofillId && { autofillId }),
			};

			console.log("[Autofill] Sending autofill request:", request);

			const result = await classifyFormFields(request);

			console.log("[AutofillProvider] Classification results:", result);
			setClassifications(result);
			setAutofillId(result.autofillId);

			const { filled, skipped } = await fillFormFields(
				applicationForm,
				result,
				isIframeForm,
			);

			console.log(`[Autofill] Filled ${filled} fields, skipped ${skipped}`);
		} catch (err) {
			console.error("[Autofill] Error:", err);
			setError("Something went wrong. Please try again.");
		} finally {
			setIsLoading(false);
		}
	}, [selectedUpload, autofillId]);

	const hasCoverLetterField = useMemo(() => {
		return classifications
			? Object.values(classifications.fields).some(
					(c) => c.path === "cover_letter",
				)
			: false;
	}, [classifications]);
	console.log("[UploadsProvider]", { classifications });
	const clearError = useCallback(() => setError(null), []);

	const value = useMemo<AutofillContextValue>(
		() => ({
			formDetected,
			isLoading,
			classifications,
			hasCoverLetterField,
			runAutofill,
			error,
			clearError,
		}),
		[
			formDetected,
			isLoading,
			classifications,
			hasCoverLetterField,
			runAutofill,
			error,
			clearError,
		],
	);

	return (
		<AutofillContext.Provider value={value}>
			{children}
		</AutofillContext.Provider>
	);
}

export function useAutofill(): AutofillContextValue {
	const context = useContext(AutofillContext);
	if (!context) {
		throw new Error("useAutofill must be used within an AutofillProvider");
	}
	return context;
}
