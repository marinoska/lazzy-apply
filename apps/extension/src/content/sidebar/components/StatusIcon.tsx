import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import type { UploadDTO } from "@/lib/api/api.js";

type UploadStatus = Pick<UploadDTO, "status" | "parseStatus">;

interface StatusIconProps {
	upload: UploadStatus;
}

type StatusInfo = {
	label: string;
	color: "neutral" | "danger" | "warning" | "success" | "primary";
	isProcessing?: boolean;
};

function getStatusInfo(upload: UploadStatus): StatusInfo | null {
	switch (upload.status) {
		case "pending":
			return { label: "Pending", color: "neutral" };
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
					return { label: "Queued", color: "neutral" };
				case "sending":
					return { label: "Sending", color: "primary" };
				case "processing":
					return { label: "Processing", color: "primary", isProcessing: true };
				case "failed":
					return { label: "Parse failed", color: "danger" };
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
			variant="soft"
			color={info.color}
			startDecorator={
				info.isProcessing ? (
					<CircularProgress
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
