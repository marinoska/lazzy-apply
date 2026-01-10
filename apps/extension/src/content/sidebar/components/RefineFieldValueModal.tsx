import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Button from "@mui/joy/Button";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { useEffect, useState } from "react";
import { BodyExtraSmallWarning } from "@/content/components/Typography.js";
import { useUploads } from "@/lib/api/context/UploadsContext.js";
import { useRefineFieldMutation } from "@/lib/api/query/useRefineFieldMutation.js";
import { Snackbar } from "../../components/Snackbar.js";
import { useAutofill } from "../context/AutofillContext.js";
import { usePreventBodyScroll } from "../hooks/usePreventBodyScroll.js";

interface RefineFieldValueModalProps {
	open: boolean;
	fieldHash: string | null;
	onClose: () => void;
	onSave: (hash: string, newValue: string) => void;
}

const MAX_INPUT_LENGTH = 800;

export function RefineFieldValueModal({
	open,
	fieldHash,
	onClose,
	onSave,
}: RefineFieldValueModalProps) {
	const { classifications } = useAutofill();
	const { selectedUpload } = useUploads();
	const [userInput, setUserInput] = useState("");
	const [refinedText, setRefinedText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const refineMutation = useRefineFieldMutation();
	const [isFilling, setIsFilling] = useState(false);
	const [fillResult, setFillResult] = useState<{
		success: boolean;
	} | null>(null);

	const fieldData = fieldHash ? classifications?.fields[fieldHash] : null;
	const hasAutofillId = !!classifications?.autofillId;

	useEffect(() => {
		if (open && fieldHash) {
			setUserInput("");
			setRefinedText("");
			setFillResult(null);

			if (!hasAutofillId) {
				setError("No autofill session found. Please run autofill first.");
				return;
			}

			if (!fieldData) {
				setError("Field not found. Please try again.");
				return;
			}

			setError(null);
		}
	}, [open, fieldHash, hasAutofillId, fieldData]);

	usePreventBodyScroll(open);

	if (!open || !fieldHash) {
		return null;
	}

	const handleGenerate = async () => {
		if (!fieldHash || !userInput.trim() || !classifications?.autofillId) return;

		if (!selectedUpload) {
			setError("No CV selected. Please select a CV first.");
			return;
		}

		setError(null);

		try {
			const result = await refineMutation.mutateAsync({
				autofillId: classifications.autofillId,
				fieldHash,
				request: {
					fieldLabel: fieldData?.label ?? "",
					fieldDescription: "",
					fieldText: currentAnswer,
					userInstructions: userInput.trim(),
				},
			});

			setRefinedText(result.refinedText);
		} catch (err) {
			console.error("[RefineFieldValueModal] Error refining field:", err);
			setError("Failed to refine answer. Please try again.");
		}
	};

	const handleFill = async () => {
		if (!fieldHash || !refinedText) return;

		setIsFilling(true);
		setFillResult(null);

		try {
			onSave(fieldHash, refinedText);
			setFillResult({ success: true });

			setTimeout(() => {
				onClose();
				setFillResult(null);
			}, 1500);
		} catch (error) {
			console.error("[RefineFieldValueModal] Failed to fill:", error);
			setFillResult({ success: false });
		} finally {
			setIsFilling(false);
		}
	};
	const question = fieldData?.label ?? "Unknown question";
	const currentAnswer = fieldData?.value ?? "";

	const hasValidInput = userInput.trim().length > 5;
	const isOverLimit = userInput.length > MAX_INPUT_LENGTH;

	const getButtonText = () => {
		if (isFilling) return "Filling...";
		if (fillResult?.success) return "Filled!";
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
					height: "auto",
					// height: "calc(100vh - 40px)",
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
							Refine Answer with AI
						</Typography>
					</Stack>
				</Stack>

				{/* Content */}
				<Stack sx={{ flex: 1, p: 2, gap: 2, overflow: "auto" }}>
					{/* Question */}
					<Stack gap={0.5}>
						<Typography level="title-sm" color="neutral">
							Question
						</Typography>
						<Typography level="body-md">{question}</Typography>
					</Stack>

					{/* Current Answer */}
					<Stack gap={0.5}>
						<Typography level="title-sm" color="neutral">
							Current Answer
						</Typography>
						<Sheet
							variant="soft"
							sx={{
								p: 1.5,
								borderRadius: "sm",
								maxHeight: "300px",
								overflow: "auto",
							}}
						>
							<Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>
								{currentAnswer || "No answer generated"}
							</Typography>
						</Sheet>
					</Stack>

					{/* User Input */}
					<Stack gap={0.5}>
						<Stack direction="row" justifyContent="space-between">
							<Typography level="title-sm" color="neutral">
								Short instructions to AI
							</Typography>
							<Typography
								level="body-xs"
								color={isOverLimit ? "danger" : "neutral"}
							>
								{userInput.length}/{MAX_INPUT_LENGTH}
							</Typography>
						</Stack>
						<Textarea
							value={userInput}
							onChange={(e) => setUserInput(e.target.value)}
							placeholder="E.g. highlight leadership experience or focus on my most recent experience."
							minRows={3}
							maxRows={4}
							error={isOverLimit}
						/>
						{isOverLimit && (
							<Typography level="body-xs" color="danger">
								Maximum {MAX_INPUT_LENGTH} characters allowed
							</Typography>
						)}
					</Stack>

					{/* Refined Answer */}
					<Stack gap={0.5} sx={{ flex: 1 }}>
						<Typography level="title-sm" color="neutral">
							Refined Answer
						</Typography>
						<Textarea
							value={refinedText}
							onChange={(e) => setRefinedText(e.target.value)}
							placeholder="Your refined answer will appear here..."
							minRows={8}
							maxRows={12}
							sx={{
								flex: 1,
								"& textarea": {
									fontSize: "0.875rem",
									lineHeight: 1.6,
								},
							}}
						/>
					</Stack>
				</Stack>
				<Divider />
				{/* Footer */}
				<Stack direction="column" p={2} gap={1}>
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
							disabled={
								!hasValidInput ||
								isOverLimit ||
								!!error ||
								refineMutation.isPending
							}
							loading={refineMutation.isPending}
							startDecorator={<AutoAwesomeIcon />}
							sx={{ flex: 1 }}
						>
							{refinedText ? "Regenerate" : "Generate answer"}
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
							disabled={!refinedText}
							startDecorator={<CheckCircleIcon />}
							sx={{ flex: 1 }}
						>
							{getButtonText()}
						</Button>
					</Stack>
					<BodyExtraSmallWarning>
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
