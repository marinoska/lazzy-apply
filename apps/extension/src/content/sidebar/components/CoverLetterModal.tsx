import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import DownloadIcon from "@mui/icons-material/Download";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { type ChangeEvent, useState } from "react";
import { Snackbar } from "@/content/components/Snackbar.js";
import { useGenerateCoverLetterMutation } from "@/lib/api/query/useGenerateCoverLetterMutation.js";
import { useAutofill } from "../context/AutofillContext.js";
import {
	createCoverLetterPdf,
	fillCoverLetterFields,
} from "../services/coverLetterFiller.js";
import {
	type CoverLetterSettings,
	DEFAULT_COVER_LETTER_SETTINGS,
	QuickSetupRow,
} from "./QuickSetupRow.js";

interface CoverLetterModalProps {
	open: boolean;
	onClose: () => void;
}

const MAX_INSTRUCTIONS_LENGTH = 200;

export function CoverLetterModal({ open, onClose }: CoverLetterModalProps) {
	const { classifications } = useAutofill();
	const [coverLetter, setCoverLetter] = useState("");
	const [instructions, setInstructions] = useState("");
	const [error, setError] = useState<string | null>(null);
	const generateMutation = useGenerateCoverLetterMutation();
	const [isFilling, setIsFilling] = useState(false);
	const [fillResult, setFillResult] = useState<{
		success: boolean;
		method: "text" | "file" | "none";
	} | null>(null);
	const [settings, setSettings] = useState<CoverLetterSettings>(
		DEFAULT_COVER_LETTER_SETTINGS,
	);

	if (!open) {
		return null;
	}

	const handleInstructionsChange = (
		event: ChangeEvent<HTMLTextAreaElement>,
	) => {
		const nextValue = event.target.value.slice(0, MAX_INSTRUCTIONS_LENGTH);
		setInstructions(nextValue);
	};

	const handleGenerate = async () => {
		if (!classifications?.autofillId) {
			setError("No autofill session found. Please run autofill first.");
			return;
		}

		setError(null);

		try {
			const result = await generateMutation.mutateAsync({
				autofillId: classifications.autofillId,
				instructions: instructions.trim() || undefined,
				settings,
			});

			setCoverLetter(result.coverLetter);
		} catch (err) {
			console.error("[CoverLetterModal] Failed to generate cover letter:", err);
			setError("Failed to generate cover letter. Please try again.");
		}
	};

	const handleRegenerate = async () => {
		setCoverLetter("");
		setInstructions("");
		setError(null);
	};

	const handleFill = async () => {
		if (!coverLetter || !classifications) return;

		setIsFilling(true);
		setFillResult(null);

		try {
			const result = await fillCoverLetterFields(coverLetter, classifications);
			setFillResult({
				success: result.filled > 0,
				method: result.method,
			});

			if (result.filled > 0) {
				// Auto-close after successful fill
				setTimeout(() => {
					onClose();
					setFillResult(null);
				}, 1500);
			}
		} catch (error) {
			console.error("[CoverLetterModal] Failed to fill:", error);
			setFillResult({ success: false, method: "none" });
		} finally {
			setIsFilling(false);
		}
	};

	const getButtonText = () => {
		if (isFilling) return "Filling...";
		if (fillResult?.success) {
			return fillResult.method === "file" ? "PDF Uploaded!" : "Text Filled!";
		}
		if (fillResult && !fillResult.success) return "Fill Failed";
		return "Add to form";
	};

	const handleDownload = () => {
		if (!coverLetter) return;

		const pdfBlob = createCoverLetterPdf(coverLetter);
		const url = URL.createObjectURL(pdfBlob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "cover_letter.pdf";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	return (
		<>
			<Sheet
				sx={{
					position: "fixed",
					top: "10px",
					right: "10px",
					width: "550px",
					height: "calc(100vh - 40px)",
					display: "flex",
					flexDirection: "column",
					bgcolor: "background.surface",
					zIndex: 10000,
					boxShadow: "lg",
				}}
			>
				{/* Header */}
				<Stack
					direction="row"
					alignItems="center"
					gap={1}
					sx={{
						p: 2,
						borderBottom: "1px solid",
						borderColor: "divider",
					}}
				>
					<IconButton
						variant="plain"
						color="neutral"
						size="sm"
						onClick={onClose}
						aria-label="Back"
					>
						<ArrowBackIcon />
					</IconButton>
					<MailOutlineIcon color="primary" />
					<Typography level="title-md" sx={{ flex: 1 }}>
						Cover Letter with AI
					</Typography>
				</Stack>

				{/* Content */}
				<Stack sx={{ flex: 1, p: 2, gap: 2, overflow: "auto" }}>
					{!coverLetter ? (
						<Stack
							sx={{
								flex: 1,
								alignItems: "center",
								justifyContent: "center",
								gap: 2,
							}}
						>
							<Typography level="body-sm" textAlign="center" color="neutral">
								Generate a personalized cover letter based on your CV and the
								job description on this page.
							</Typography>
							<QuickSetupRow settings={settings} onChange={setSettings} />
							<Stack gap={0.5} width="100%">
								<Stack
									direction="row"
									alignItems="center"
									justifyContent="space-between"
								>
									<Typography level="body-xs" sx={{ color: "neutral.600" }}>
										Short instructions (optional)
									</Typography>
									<Typography level="body-xs" sx={{ color: "neutral.500" }}>
										{instructions.length}/{MAX_INSTRUCTIONS_LENGTH}
									</Typography>
								</Stack>
								<Textarea
									minRows={3}
									maxRows={4}
									value={instructions}
									onChange={handleInstructionsChange}
									placeholder="E.g. highlight leadership experience or focus on my most recent experience."
									slotProps={{
										textarea: {
											maxLength: MAX_INSTRUCTIONS_LENGTH,
										},
									}}
									sx={{
										width: "100%",
										"& textarea": {
											fontSize: "0.85rem",
										},
									}}
								/>
							</Stack>
							<Button
								variant="solid"
								color="primary"
								size="lg"
								onClick={handleGenerate}
								loading={generateMutation.isPending}
								disabled={!classifications?.autofillId || !!error}
								startDecorator={<MailOutlineIcon />}
							>
								Generate Cover Letter
							</Button>
						</Stack>
					) : (
						<>
							<Textarea
								value={coverLetter}
								onChange={(e) => setCoverLetter(e.target.value)}
								minRows={12}
								maxRows={20}
								sx={{
									flex: 1,
									"& textarea": {
										fontSize: "0.875rem",
										lineHeight: 1.6,
									},
								}}
							/>
							<Stack direction="row" gap={1}>
								<Button
									variant="outlined"
									color="neutral"
									size="sm"
									onClick={handleRegenerate}
									loading={generateMutation.isPending}
									startDecorator={<AutoAwesomeIcon />}
									sx={{ flex: 1 }}
								>
									Regenerate
								</Button>
								<Button
									variant="outlined"
									color="neutral"
									size="sm"
									onClick={handleDownload}
									disabled={!coverLetter}
									startDecorator={<DownloadIcon />}
									sx={{ flex: 1 }}
								>
									Download
								</Button>
								<Button
									variant="solid"
									color={
										fillResult?.success
											? "success"
											: fillResult && !fillResult.success
												? "danger"
												: "primary"
									}
									size="sm"
									onClick={handleFill}
									loading={isFilling}
									disabled={!coverLetter || !classifications}
									startDecorator={<UploadFileIcon />}
									sx={{ flex: 1 }}
								>
									{getButtonText()}
								</Button>
							</Stack>
						</>
					)}
				</Stack>
			</Sheet>
			<Snackbar
				msg={error ?? ""}
				show={!!error}
				type="danger"
				onClose={() => setError(null)}
			/>
		</>
	);
}
