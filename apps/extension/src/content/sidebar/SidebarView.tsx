import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { useState } from "react";
import { Snackbar } from "../../components/Snackbar.js";
import {
	ActionButtons,
	LoadingIndicator,
	SidebarHeader,
	StatusMessage,
	UploadSection,
	UserInfo,
} from "./components/index.js";
import type { SidebarViewProps } from "./types.js";

export function SidebarView({
	state,
	onClose,
	onSignIn,
	onSignOut,
}: SidebarViewProps) {
	const { visible, loading, status, session } = state;
	const [showDropzone, setShowDropzone] = useState(false);
	const [alertMessage, setAlertMessage] = useState("");
	const [alertType, setAlertType] = useState<"success" | "danger">("success");

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

	return (
		<div
			className={`overlay${visible ? " visible" : ""}`}
			role="presentation"
			aria-hidden={visible ? "false" : "true"}
		>
			<Sheet className="panel" variant="soft" color="neutral">
				<Stack spacing={2} sx={{ p: 2.5 }}>
					<SidebarHeader
						onClose={onClose}
						onSignOut={onSignOut}
						session={session}
					/>
					<Divider orientation="horizontal" color="border" />
					{/* <StatusMessage status={status} /> */}

					<LoadingIndicator loading={loading} />

					{/* <UserInfo session={session} loading={loading} /> */}

					<Divider orientation="horizontal" color="border" />

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
				</Stack>
				<Snackbar
					msg={alertMessage}
					show={!!alertMessage}
					type={alertType}
					onClose={() => setAlertMessage("")}
				/>
			</Sheet>
		</div>
	);
}
