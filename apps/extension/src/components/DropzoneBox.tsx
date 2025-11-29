import { MAXIMUM_UPLOAD_SIZE_BYTES } from "@/lib/consts.js";
import { validateFileContent } from "@/lib/files.js";
import { useUploadMutation } from "@/hooks/useUploadMutation.js";
import type { StateSetter } from "@/types.js";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import CloudUpload from "@mui/icons-material/CloudUpload";
import ErrorIcon from "@mui/icons-material/Error";
import { Alert } from "@mui/joy";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Snackbar } from "./Snackbar";

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
					const errorMessage =
						err instanceof Error ? err.message : "Upload failed";
					setError(errorMessage);
					setUploadSuccess(false);
					// Call error callback
					onUploadError?.(errorMessage);
					// Note: Worker will clean up failed uploads from quarantine after timeout
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
					<Typography level="h2">
						<CloudUpload color="primary" />
					</Typography>
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
								<Typography fontWeight="300" level="body-xs">
									{file.name}
								</Typography>
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
							<Typography level="body-sm">Drag & drop a CV or</Typography>
							<input {...getInputProps()} />
							<Button size="md" sx={{ m: 1 }} color="primary" onClick={open}>
								Browse Files
							</Button>
							<Typography level="body-xs" textAlign="center">
								Supported formats: PDF, DOCX
								<br />
								(Max 3MB)
							</Typography>
						</>
					)}
				</Stack>
			)}

			{uploadSuccess && (
				<Alert
					variant="soft"
					color="success"
					startDecorator={<CheckCircleIcon />}
					sx={{ width: 600 }}
				>
					<Typography level="body-sm" color="success">
						File uploaded successfully!
					</Typography>
				</Alert>
			)}

			{error && (
				<Alert
					variant="soft"
					color="danger"
					startDecorator={<ErrorIcon />}
					endDecorator={
						<Button
							size="sm"
							variant="plain"
							color="danger"
							onClick={() => setError("")}
						>
							<CloseIcon />
						</Button>
					}
					sx={{ width: 600 }}
				>
					<Typography level="body-sm">{error}</Typography>
				</Alert>
			)}

			<Snackbar msg={error} onClose={() => setError("")} />
		</>
	);
};
