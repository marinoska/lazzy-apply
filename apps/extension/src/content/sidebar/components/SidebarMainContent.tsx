import Button from "@mui/joy/Button";
import { useState } from "react";
import { UploadsProvider } from "@/lib/api/context/UploadsContext.js";
import { Snackbar } from "../../../components/Snackbar.js";
import { AutofillButton } from "./AutofillButton.js";
import { CVSelector } from "./CVSelector.js";
import { UploadSection } from "./UploadSection.js";

interface SidebarMainContentProps {
	loading: boolean;
}

export function SidebarMainContent({
	loading: sessionLoading,
}: SidebarMainContentProps) {
	const [showDropzone, setShowDropzone] = useState(false);
	const [activeFileId, setActiveFileId] = useState<string | null>(null);
	const [alertMessage, setAlertMessage] = useState("");
	const [alertType, setAlertType] = useState<"success" | "danger">("success");

	const handleUploadComplete = (_fileId: string, _objectKey: string) => {
		setShowDropzone(false);
		setAlertType("success");
		setAlertMessage("CV uploaded successfully!");
	};

	const handleUploadError = (error: string) => {
		setShowDropzone(false);
		setAlertType("danger");
		setAlertMessage(error || "Upload failed. Please try again.");
	};

	const handleAutofillError = (error: string) => {
		setAlertType("danger");
		setAlertMessage(error);
	};

	if (sessionLoading) {
		return null;
	}

	return (
		<UploadsProvider>
			<CVSelector
				activeFileId={activeFileId}
				onActiveChange={setActiveFileId}
			/>

			{!showDropzone && (
				<Button
					fullWidth
					variant="solid"
					color="primary"
					size="md"
					onClick={() => setShowDropzone(true)}
				>
					Upload your CV
				</Button>
			)}
			<UploadSection
				visible={showDropzone}
				onCancel={() => setShowDropzone(false)}
				onUploadComplete={handleUploadComplete}
				onUploadError={handleUploadError}
			/>
			<AutofillButton onError={handleAutofillError} />
			<Snackbar
				msg={alertMessage}
				show={!!alertMessage}
				type={alertType}
				onClose={() => setAlertMessage("")}
			/>
		</UploadsProvider>
	);
}
