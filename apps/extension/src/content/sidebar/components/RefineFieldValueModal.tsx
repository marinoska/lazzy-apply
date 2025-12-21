import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { useEffect, useState } from "react";
import { useUploads } from "@/lib/api/context/UploadsContext.js";
import { useRefineFieldMutation } from "@/lib/api/query/useRefineFieldMutation.js";
import { Snackbar } from "../../components/Snackbar.js";
import { useAutofill } from "../context/AutofillContext.js";

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
	const [error, setError] = useState<string | null>(null);
	const refineMutation = useRefineFieldMutation();

	const fieldData = fieldHash ? classifications?.fields[fieldHash] : null;
	const hasAutofillId = !!classifications?.autofillId;

	useEffect(() => {
		if (open && fieldHash) {
			setUserInput("");

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

	if (!open || !fieldHash) {
		return null;
	}

	const handleSave = async () => {
		if (!fieldHash || !userInput.trim() || !classifications?.autofillId) return;

		if (!selectedUpload) {
			setError("No CV selected. Please select a CV first.");
			return;
		}

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

			onSave(fieldHash, result.refinedText);
			onClose();
		} catch (err) {
			console.error("[RefineFieldValueModal] Error refining field:", err);
			setError("Failed to refine answer. Please try again.");
		}
	};
	const question = fieldData?.label ?? "Unknown question";
	const currentAnswer = fieldData?.value ?? "";

	const hasValidInput = userInput.trim().length > 5;
	const isOverLimit = userInput.length > MAX_INPUT_LENGTH;

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
					<AutoFixHighIcon color="primary" />
					<Typography level="title-md" sx={{ flex: 1 }}>
						Refine Answer with AI
					</Typography>
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
					<Stack gap={0.5} sx={{ flex: 1 }}>
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
							minRows={6}
							maxRows={8}
							error={isOverLimit}
						/>
						{isOverLimit && (
							<Typography level="body-xs" color="danger">
								Maximum {MAX_INPUT_LENGTH} characters allowed
							</Typography>
						)}
					</Stack>
				</Stack>

				{/* Footer */}
				<Stack
					direction="row"
					gap={1}
					sx={{
						p: 2,
						borderTop: "1px solid",
						borderColor: "divider",
					}}
				>
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
						onClick={handleSave}
						disabled={
							!hasValidInput ||
							isOverLimit ||
							!!error ||
							refineMutation.isPending
						}
						loading={refineMutation.isPending}
						sx={{ flex: 1 }}
					>
						Generate answer
					</Button>
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
