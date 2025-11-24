import {
	type UploadSignedUrlResponse,
	completeUpload,
	getUploadSignedUrl,
	uploadFileToSignedUrl,
} from "@/lib/api/api.js";
import { MAXIMUM_UPLOAD_SIZE_BYTES } from "@/lib/consts.js";
import { validateFileContent } from "@/lib/files.js";
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
import { useState } from "react";
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
	const [uploading, setUploading] = useState(false);
	const [uploadSuccess, setUploadSuccess] = useState(false);

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

		setUploading(true);
		setError("");
		setUploadSuccess(false);
		let uploadDetails: UploadSignedUrlResponse | null = null;

		try {
			// Get signed URL from API
			uploadDetails = await getUploadSignedUrl(file.name, file.type, file.size);

			// Upload file to signed URL
			await uploadFileToSignedUrl(file, uploadDetails);

			// Signal completion - server validates and promotes from quarantine
			const completeResponse = await completeUpload(uploadDetails.fileId);

			setUploadSuccess(true);

			// Use the returned fileId (might be different if deduplicated)
			const finalFileId = completeResponse.fileId;
			const finalObjectKey = `cv/${finalFileId}`;

			onUploadComplete?.(finalFileId, finalObjectKey);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Upload failed";
			setError(errorMessage);
			setUploadSuccess(false);
			// Call error callback
			onUploadError?.(errorMessage);
			// Note: Worker will clean up failed uploads from quarantine after timeout
		} finally {
			setUploading(false);
		}
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
					gap="4"
					{...getRootProps()}
					sx={{
						p: 2,
						width: 600,
						minHeight: 200,
						border: "2px dashed",
						borderRadius: "md",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Typography level="h2">
						<CloudUpload />
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
										disabled={uploading}
									>
										<CloseIcon />
									</Button>
								}
								sx={{ width: "100%" }}
							>
								<Typography fontWeight="300">{file.name}</Typography>
							</Alert>
							<Button
								size="lg"
								color="primary"
								onClick={handleUpload}
								disabled={uploading}
								startDecorator={
									uploading ? <CircularProgress size="sm" /> : <CloudUpload />
								}
							>
								{uploading ? "Uploading..." : "Upload File"}
							</Button>
						</Stack>
					) : (
						<>
							<Typography level="body-sm">Drag & drop a CV or</Typography>
							<input {...getInputProps()} />
							<Button size="lg" sx={{ m: 1 }} color="neutral" onClick={open}>
								Browse Files
							</Button>
							<Typography level="body-xs">
								Supported formats: PDF, DOCX (Max 3MB)
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
