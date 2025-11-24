import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import React, { useState } from "react";
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

	const handleUploadComplete = (fileId: string, objectKey: string) => {
		console.log("File uploaded:", fileId, objectKey);
		// Hide dropzone and show upload button again
		setShowDropzone(false);
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

					<StatusMessage status={status} />

					<LoadingIndicator loading={loading} />

					<UserInfo session={session} loading={loading} />

					<Divider sx={{ my: 0.5 }} />

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
						/>
					)}
				</Stack>
			</Sheet>
		</div>
	);
}
