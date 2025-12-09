import Button from "@mui/joy/Button";
import { useState } from "react";
import { Snackbar } from "../../../components/Snackbar.js";
import { ApplicationSection } from "./ApplicationSection.js";
import { CVSelector } from "./CVSelector.js";
import { UploadSection } from "./UploadSection.js";

interface SidebarMainContentProps {
	loading: boolean;
}

export function SidebarMainContent({
	loading: sessionLoading,
}: SidebarMainContentProps) {
	const [showDropzone, setShowDropzone] = useState(false);
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
		<>
			<CVSelector />

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
			<ApplicationSection onError={handleAutofillError} />
			<Snackbar
				msg={alertMessage}
				show={!!alertMessage}
				type={alertType}
				onClose={() => setAlertMessage("")}
			/>
		</>
	);
}
