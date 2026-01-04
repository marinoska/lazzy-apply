import CheckIcon from "@mui/icons-material/Check";
import DownloadIcon from "@mui/icons-material/Download";
import NotACVIcon from "@mui/icons-material/ErrorOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { Chip, IconButton, Stack, Typography } from "@mui/joy";
import CircularProgress from "@mui/joy/CircularProgress";
import { useState } from "react";
import { getDownloadUrl } from "@/lib/api/api.js";
import type { EnhancedUploadDTO } from "@/lib/api/context/UploadsContext.js";

interface StatusIconProps {
	upload: EnhancedUploadDTO;
}

type StatusInfo = {
	label: string;
	color: "neutral" | "danger" | "warning" | "success" | "primary";
	isProcessing?: boolean;
	isDone?: boolean;
	isDuplicate?: boolean;
	isFailed?: boolean;
	isDeleted?: boolean;
	isNotACV?: boolean;
};

interface DownloadButtonProps {
	fileId: string;
}

function DownloadButton({ fileId }: DownloadButtonProps) {
	const [isLoading, setIsLoading] = useState(false);

	const handleDownload = async (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsLoading(true);
		try {
			const { downloadUrl } = await getDownloadUrl(fileId);
			window.open(downloadUrl, "_blank");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<IconButton
			size="sm"
			variant="outlined"
			color="success"
			onClick={handleDownload}
			disabled={isLoading}
			aria-label="Download CV"
			sx={{ minWidth: 32, minHeight: 24 }}
		>
			{isLoading ? (
				<CircularProgress
					size="sm"
					sx={{ "--CircularProgress-size": "14px" }}
				/>
			) : (
				<Stack direction="row" alignItems="center" gap={0.5}>
					<DownloadIcon sx={{ fontSize: 16 }} />
					<Typography level="body-xs" sx={{ fontSize: 10 }}>
						View
					</Typography>
				</Stack>
			)}
		</IconButton>
	);
}

function getStatusInfo(upload: EnhancedUploadDTO): StatusInfo | null {
	switch (upload.status) {
		case "pending":
			return { label: "Pending", color: "neutral", isProcessing: true };
		case "failed":
			return { label: "Failed", color: "danger", isFailed: true };
		case "rejected":
			return { label: "Rejected", color: "danger", isFailed: true };
		case "deduplicated":
			return { label: "Duplicate", color: "warning", isDuplicate: true };
		case "deleted-by-user":
			return { label: "Deleted", color: "neutral", isDeleted: true };
		case "uploaded":
			switch (upload.parseStatus) {
				case "completed":
					return { label: "Ready", color: "success", isDone: true };
				case "pending":
					return { label: "Queued", color: "neutral", isProcessing: true };
				case "sending":
					return { label: "Sending", color: "primary", isProcessing: true };
				case "processing":
					return { label: "Processing", color: "primary", isProcessing: true };
				case "failed":
					return { label: "Parse failed", color: "danger", isFailed: true };
				case "not-a-cv":
					return { label: "Not a CV", color: "warning", isNotACV: true };
			}
	}
	return null;
}

export function StatusChip({ upload }: StatusIconProps) {
	const info = getStatusInfo(upload);

	if (!info) return null;

	return (
		<Stack direction="column" alignItems="center" gap={0.5}>
			<Chip
				size="sm"
				variant="outlined"
				color={info.color}
				startDecorator={
					info.isProcessing ? (
						<CircularProgress
							color={info.color}
							size="sm"
							sx={{ "--CircularProgress-size": "12px" }}
						/>
					) : info.isDone ? (
						<CheckIcon sx={{ fontSize: 12 }} />
					) : info.isDuplicate ? (
						<RemoveCircleOutlineIcon sx={{ fontSize: 12 }} />
					) : info.isFailed ? (
						<RemoveCircleOutlineIcon sx={{ fontSize: 12 }} />
					) : info.isDeleted ? (
						<RemoveCircleOutlineIcon sx={{ fontSize: 12 }} />
					) : info.isNotACV ? (
						<NotACVIcon sx={{ fontSize: 12 }} />
					) : undefined
				}
				sx={{ fontSize: "10px", fontWeight: 600 }}
			>
				{info.label}
			</Chip>
			{info.isDone && <DownloadButton fileId={upload.fileId} />}
		</Stack>
	);
}

// Keep for backward compatibility
export const StatusIcon = StatusChip;
