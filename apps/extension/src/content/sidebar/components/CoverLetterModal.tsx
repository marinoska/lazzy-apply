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
	const [isGenerating, setIsGenerating] = useState(false);
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
		setIsGenerating(true);
		try {
			// TODO: Call API to generate cover letter
			console.log("[CoverLetterModal] Generating cover letter...");
			// Placeholder for now
			await new Promise((resolve) => setTimeout(resolve, 1000));
			setCoverLetter(
				"Dear Hiring Manager,\n\nI am writing to express my interest in this position...\n\n[Cover letter content will be generated here based on your CV and the job description]\n\nBest regards",
			);
		} finally {
			setIsGenerating(false);
		}
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
							Generate a personalized cover letter based on your CV and the job
							description on this page.
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
								maxLength={MAX_INSTRUCTIONS_LENGTH}
								placeholder="E.g. highlight leadership experience or focus on my most recent experience."
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
							loading={isGenerating}
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
								onClick={() => setCoverLetter("")}
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
	);
}
