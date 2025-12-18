import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import { useState } from "react";
import { DropzoneBox } from "@/content/components/DropzoneBox.js";

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

	const handleCancel = () => {
		setFile(null);
		onCancel();
	};

	return (
		<Box
			sx={{
				opacity: visible ? 1 : 0,
				maxHeight: visible ? 500 : 0,
				overflow: "hidden",
				transition: "opacity 0.3s ease-in-out, max-height 0.3s ease-in-out",
				width: "100%",
			}}
		>
			<Stack direction="column" spacing={2} alignItems="center">
				<DropzoneBox
					file={file}
					setFile={setFile}
					onUploadComplete={onUploadComplete}
					onUploadError={onUploadError}
				/>
				<Button
					variant="solid"
					color="neutral"
					size="sm"
					onClick={handleCancel}
				>
					Close
				</Button>
			</Stack>
		</Box>
	);
}
