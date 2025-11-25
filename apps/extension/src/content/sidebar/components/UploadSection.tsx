import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import React, { useState } from "react";
import { DropzoneBox } from "../../../components/DropzoneBox.js";

interface UploadSectionProps {
	visible: boolean;
	onCancel: () => void;
	onUploadComplete: (fileId: string, objectKey: string) => void;
	onUploadError: (error: string) => void;
}

export function UploadSection({
	visible,
	onCancel,
	onUploadComplete,
	onUploadError,
}: UploadSectionProps) {
	const [file, setFile] = useState<File | null>(null);

	if (!visible) return null;

	const handleCancel = () => {
		setFile(null);
		onCancel();
	};

	return (
		<>
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 2,
				}}
			>
				<DropzoneBox
					file={file}
					setFile={setFile}
					onUploadComplete={onUploadComplete}
					onUploadError={onUploadError}
				/>
				<Button
					variant="outlined"
					color="neutral"
					size="sm"
					onClick={handleCancel}
				>
					Cancel
				</Button>
			</Box>
		</>
	);
}
