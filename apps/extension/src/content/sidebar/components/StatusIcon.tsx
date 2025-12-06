import CheckIcon from "@mui/icons-material/Check";
import NotACVIcon from "@mui/icons-material/ErrorOutline";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import type { UploadState } from "@/lib/api/api.js";

interface StatusIconProps {
	upload: UploadState;
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

function getStatusInfo(upload: UploadState): StatusInfo | null {
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
	console.log({
		status: upload.status,
		parseStatus: upload.status === "uploaded" ? upload.parseStatus : undefined,
		info: info?.label,
	});
	if (!info) return null;

	return (
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
	);
}

// Keep for backward compatibility
export const StatusIcon = StatusChip;
