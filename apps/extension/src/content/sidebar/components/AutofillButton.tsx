import type { AutofillRequest, Field, FormInput } from "@lazyapply/types";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import { useEffect, useState } from "react";
import { classifyFormFields } from "@/lib/api/api.js";
import { detectApplicationForm } from "../../scanner/formDetector.js";

interface AutofillButtonProps {
	hasUploads: boolean;
	onError: (message: string) => void;
}

export function AutofillButton({ hasUploads, onError }: AutofillButtonProps) {
	const [loading, setLoading] = useState(false);
	const [formDetected, setFormDetected] = useState<boolean | null>(null);

	useEffect(() => {
		if (!hasUploads) return;
		const form = detectApplicationForm();
		setFormDetected(form !== null && form.fields.length > 0);
	}, [hasUploads]);

	if (!hasUploads) {
		return null;
	}

	const handleAutofill = async () => {
		setLoading(true);

		try {
			const applicationForm = detectApplicationForm();

			if (!applicationForm || applicationForm.fields.length === 0) {
				setFormDetected(false);
				setLoading(false);
				return;
			}

			const fields: Field[] = applicationForm.fields.map((field) => ({
				hash: field.hash,
				field: {
					id: field.id ?? "",
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
				fields: fields.map((f) => ({ hash: f.hash, path: null })),
				pageUrl: window.location.href,
				action: applicationForm.formElement?.action ?? null,
			};

			const request: AutofillRequest = { form, fields };

			console.log("[AutofillButton] Sending autofill request:", request);

			const classifications = await classifyFormFields(request);

			console.log("[AutofillButton] Classification results:", classifications);
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
