import CloseIcon from "@mui/icons-material/Close";
import CloudUpload from "@mui/icons-material/CloudUpload";
import { Divider } from "@mui/joy";
import Alert from "@mui/joy/Alert";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
	BodyExtraSmall,
	BodyExtraSmallWarning,
	BodySmallDarker,
	HeadingLarge,
} from "@/content/components/Typography.js";
import { useUploadMutation } from "@/lib/api/query/useUploadMutation.js";
import { MAXIMUM_UPLOAD_SIZE_BYTES } from "@/lib/consts.js";
import { getUserFriendlyMessage } from "@/lib/errorUtils.js";
import { validateFileContent } from "@/lib/files.js";
import type { StateSetter } from "@/types.js";
import { AppAlert } from "./AppAlert.js";
import { Snackbar } from "./Snackbar.js";

export const DropzoneBox = ({
	file,
	setFile,
	onUploadComplete,
	onUploadError,
}: {
	file: File | null;
	setFile: StateSetter<File | null>;
	onUploadComplete?: (fileId: string, objectKey: string) => void;
	onUploadError?: (error: string) => void;
}) => {
	const [error, setError] = useState("");
	const [uploadSuccess, setUploadSuccess] = useState(false);
	const uploadMutation = useUploadMutation();

	// Reset uploadSuccess when file is cleared
	useEffect(() => {
		if (!file) {
			setUploadSuccess(false);
		}
	}, [file]);

	const onDrop = async (acceptedFiles: File[]) => {
		if (acceptedFiles.length > 1) {
			console.log("Only one file can be uploaded.");
			return;
		}

		const isValid = await validateFileContent(acceptedFiles[0]);
		if (isValid) {
			setError("");
			setUploadSuccess(false);
			setFile(acceptedFiles[0]);
		} else {
			setError(`Invalid file content: ${acceptedFiles[0].name}`);
			setFile(null);
		}
	};

	const handleUpload = async () => {
		if (!file) return;

		setError("");
		setUploadSuccess(false);

		uploadMutation.mutate(
			{ file },
			{
				onSuccess: (completeResponse) => {
					setUploadSuccess(true);

					// Use the returned fileId (might be different if deduplicated)
					const finalFileId = completeResponse.fileId;
					const finalObjectKey = `cv/${finalFileId}`;

					onUploadComplete?.(finalFileId, finalObjectKey);
					// Clear the file after successful upload
					setFile(null);
				},
				onError: (err) => {
					// Log detailed error to console for debugging
					console.error("[DropzoneBox] Upload error:", err);
					// Show user-friendly message in UI
					const userMessage = getUserFriendlyMessage(err);
					setError(userMessage);
					setUploadSuccess(false);
					// Call error callback with user-friendly message
					onUploadError?.(userMessage);
				},
			},
		);
	};

	const { getRootProps, getInputProps, open } = useDropzone({
		onDrop,
		multiple: false,
		noClick: true,
		accept: {
			// Restrict file formats
			"application/pdf": [".pdf"], // PDFs
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
				[".docx"],
		},
		maxSize: MAXIMUM_UPLOAD_SIZE_BYTES,
	});

	return (
		<>
			{!uploadSuccess && (
				<Stack
					gap="2"
					{...getRootProps()}
					sx={{
						p: 1,
						width: "100%",
						// minHeight: 200,
						border: "2px dashed lightgray",
						borderRadius: "lg",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<BodyExtraSmallWarning sx={{ textAlign: "center" }}>
						You can process up to <strong>10 CVs</strong> per 24h.
					</BodyExtraSmallWarning>

					<Stack alignItems="center" gap={0.5} m={2}>
						<Button
							size="lg"
							variant="solid"
							color="primary"
							disabled
							sx={{
								fontSize: "1.5rem",
								fontWeight: "bold",
								minWidth: "60px",
							}}
						>
							<Stack direction="column">
								9<BodySmallDarker>left today</BodySmallDarker>
								<BodyExtraSmall>resets in 3h</BodyExtraSmall>
							</Stack>
						</Button>
					</Stack>
					<Divider orientation="horizontal" />
					<HeadingLarge>
						<CloudUpload color="primary" />
					</HeadingLarge>
					{file ? (
						<Stack gap={2} alignItems="center" width="100%">
							<Alert
								variant="soft"
								color="neutral"
								endDecorator={
									<Button
										size="sm"
										variant="solid"
										onClick={() => {
											setFile(null);
											setUploadSuccess(false);
										}}
										color="neutral"
										disabled={uploadMutation.isPending}
									>
										<CloseIcon />
									</Button>
								}
								sx={{ width: "100%" }}
							>
								<BodyExtraSmall sx={{ fontWeight: 300 }}>
									{file.name}
								</BodyExtraSmall>
							</Alert>
							<Button
								size="md"
								color="primary"
								onClick={handleUpload}
								disabled={uploadMutation.isPending}
								startDecorator={
									uploadMutation.isPending ? (
										<CircularProgress size="sm" />
									) : (
										<CloudUpload />
									)
								}
							>
								{uploadMutation.isPending ? "Uploading..." : "Upload File"}
							</Button>
						</Stack>
					) : (
						<>
							<BodySmallDarker>Drag & drop a CV or</BodySmallDarker>
							<input {...getInputProps()} />
							<Button size="md" sx={{ m: 1 }} color="primary" onClick={open}>
								Browse Files
							</Button>
							<BodyExtraSmall sx={{ textAlign: "center" }}>
								Supported formats: PDF, DOCX
								<br />
								(Max 3MB)
							</BodyExtraSmall>
						</>
					)}
				</Stack>
			)}

			{uploadSuccess && (
				<AppAlert type="success" message="File uploaded successfully!" />
			)}

			{error && (
				<AppAlert type="error" message={error} onClose={() => setError("")} />
			)}

			<Snackbar msg={error} onClose={() => setError("")} />
		</>
	);
};
