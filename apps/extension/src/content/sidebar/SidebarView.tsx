import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { useState } from "react";
import { useUploadsQuery } from "@/lib/api/query/useUploadsQuery.js";
import { Snackbar } from "../../components/Snackbar.js";
import {
	ActionButtons,
	AutofillButton,
	CVSelector,
	LoadingIndicator,
	SidebarHeader,
	StatusMessage,
	UploadSection,
} from "./components/index.js";
import type { SidebarViewProps } from "./types.js";

export function SidebarView({
	state,
	onClose,
	onSignIn,
	onSignOut,
}: SidebarViewProps) {
	const { visible, loading, status, session } = state;
	const { data: uploadsData } = useUploadsQuery({ limit: 5 });
	const hasUploads = (uploadsData?.uploads?.length ?? 0) > 0;
	const [showDropzone, setShowDropzone] = useState(false);
	const [activeFileId, setActiveFileId] = useState<string | null>(null);
	const [alertMessage, setAlertMessage] = useState("");
	const [alertType, setAlertType] = useState<"success" | "danger">("success");
	const statusIsError =
		status?.startsWith("Failed") || status?.startsWith("Error");

	const handleUploadComplete = (fileId: string, objectKey: string) => {
		console.log("File uploaded:", fileId, objectKey);
		// Hide dropzone and show upload button again
		setShowDropzone(false);
		// Show success notification
		setAlertType("success");
		setAlertMessage("CV uploaded successfully!");
	};

	const handleUploadError = (error: string) => {
		console.error("Upload error:", error);
		// Hide dropzone and show upload button again
		setShowDropzone(false);
		// Show error notification
		setAlertType("danger");
		setAlertMessage(error || "Upload failed. Please try again.");
	};

	const handleAutofillError = (error: string) => {
		setAlertType("danger");
		setAlertMessage(error);
	};

	return (
		<div
			className={`overlay${visible ? " visible" : ""}`}
			role="presentation"
			aria-hidden={visible ? "false" : "true"}
		>
			<Sheet className="panel" variant="soft" color="neutral">
				<Stack gap={2} sx={{ p: 2.5 }}>
					<SidebarHeader
						onClose={onClose}
						onSignOut={onSignOut}
						session={session}
					/>
					<Divider orientation="horizontal" color="border" />
					<StatusMessage status={status} />

					<LoadingIndicator loading={loading} />

					{/* <UserInfo session={session} loading={loading} /> */}

					{session && (
						<CVSelector
							activeFileId={activeFileId}
							onActiveChange={setActiveFileId}
						/>
					)}

					{!showDropzone && (
						<ActionButtons
							session={session}
							loading={loading}
							onSignIn={onSignIn}
							onUploadClick={() => setShowDropzone(true)}
						/>
					)}
					{session && (
						<UploadSection
							visible={showDropzone}
							onCancel={() => setShowDropzone(false)}
							onUploadComplete={handleUploadComplete}
							onUploadError={handleUploadError}
						/>
					)}
					{session && hasUploads && (
						<AutofillButton
							hasUploads={hasUploads}
							onError={handleAutofillError}
						/>
					)}
				</Stack>
				<Snackbar
					msg={alertMessage}
					show={!!alertMessage}
					type={alertType}
					onClose={() => setAlertMessage("")}
				/>
				{statusIsError && (
					<Snackbar msg={status ?? ""} show={true} type="danger" />
				)}
			</Sheet>
		</div>
	);
}
