import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { Snackbar } from "@/content/components/Snackbar.js";
import { BodyExtraSmallWarning } from "@/content/components/Typography.js";
import { useGenerateCoverLetterMutation } from "@/lib/api/query/useGenerateCoverLetterMutation.js";
import { useAutofill } from "../context/AutofillContext.js";
import { fillCoverLetterFields } from "../services/coverLetterFiller.js";
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
	const {
		classifications,
		jdRawText,
		coverLetter: existingCoverLetter,
	} = useAutofill();
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

	const coverLetterFieldHash = useMemo(() => {
		if (!classifications) return null;
		const coverLetterField = Object.entries(classifications.fields).find(
			([_, field]) => field.path === "cover_letter",
		);
		return coverLetterField?.[0] ?? null;
	}, [classifications]);

	useEffect(() => {
		if (
			open &&
			existingCoverLetter &&
			!coverLetter &&
			existingCoverLetter.hash === coverLetterFieldHash
		) {
			setCoverLetter(existingCoverLetter.value);
			setSettings({
				length: existingCoverLetter.length as CoverLetterSettings["length"],
				format: existingCoverLetter.format as CoverLetterSettings["format"],
			});
		}
	}, [open, existingCoverLetter, coverLetter, coverLetterFieldHash]);

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

		if (!coverLetterFieldHash) {
			setError("No cover letter field found in the form.");
			return;
		}

		setError(null);

		try {
			const result = await generateMutation.mutateAsync({
				autofillId: classifications.autofillId,
				fieldHash: coverLetterFieldHash,
				jdRawText: jdRawText || undefined,
				instructions: instructions.trim() || undefined,
				settings,
			});

			setCoverLetter(result.coverLetter);
		} catch (err) {
			console.error("[CoverLetterModal] Failed to generate cover letter:", err);
			setError("Failed to generate cover letter. Please try again.");
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
					gap={1}
					sx={{
						p: 2,
						borderBottom: "1px solid",
						borderColor: "divider",
					}}
				>
					<Stack direction="row" alignItems="center" gap={1}>
						<IconButton
							variant="plain"
							color="neutral"
							size="sm"
							onClick={onClose}
							aria-label="Back"
						>
							<ArrowBackIcon />
						</IconButton>
						<AutoFixHighIcon color="primary" />
						<Typography level="title-md" sx={{ flex: 1 }}>
							Cover Letter with AI
						</Typography>
					</Stack>
				</Stack>

				{/* Content */}
				<Stack sx={{ flex: 1, p: 2, gap: 2, overflow: "auto" }}>
					<Typography level="body-sm" color="neutral">
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
							minRows={2}
							maxRows={3}
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

					<Textarea
						value={coverLetter}
						onChange={(e) => setCoverLetter(e.target.value)}
						placeholder="Your generated cover letter will appear here..."
						minRows={8}
						maxRows={15}
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
							onClick={onClose}
							sx={{ flex: 1 }}
						>
							Cancel
						</Button>
						<Button
							variant="solid"
							color="primary"
							size="sm"
							onClick={handleGenerate}
							loading={generateMutation.isPending}
							disabled={!classifications?.autofillId || !!error}
							startDecorator={<AutoAwesomeIcon />}
							sx={{ flex: 1 }}
						>
							{coverLetter ? "Regenerate" : "Generate"}
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
					<BodyExtraSmallWarning alignItems={"center"}>
						Generation uses a small amount of credits
					</BodyExtraSmallWarning>
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
