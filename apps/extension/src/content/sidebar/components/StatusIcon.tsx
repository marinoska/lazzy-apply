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
};

function getStatusInfo(upload: UploadState): StatusInfo | null {
	switch (upload.status) {
		case "pending":
			return { label: "Pending", color: "neutral", isProcessing: true };
		case "failed":
			return { label: "Failed", color: "danger" };
		case "rejected":
			return { label: "Rejected", color: "danger" };
		case "deduplicated":
			return { label: "Duplicate", color: "warning" };
		case "deleted-by-user":
			return { label: "Deleted", color: "neutral" };
		case "uploaded":
			switch (upload.parseStatus) {
				case "completed":
					return { label: "Ready", color: "success" };
				case "pending":
					return { label: "Queued", color: "neutral", isProcessing: true };
				case "sending":
					return { label: "Sending", color: "primary", isProcessing: true };
				case "processing":
					return { label: "Processing", color: "primary", isProcessing: true };
				case "failed":
					return { label: "Parse failed", color: "danger" };
				case "not-a-cv":
					return { label: "Not a CV", color: "warning" };
			}
	}
	return null;
}

export function StatusChip({ upload }: StatusIconProps) {
	const info = getStatusInfo(upload);
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
