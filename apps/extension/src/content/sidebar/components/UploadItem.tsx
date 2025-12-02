import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import { BodyExtraSmall } from "@/components/Typography.js";
import type { ParseStatus, UploadDTO } from "@/lib/api/api.js";
import { useDeleteUploadMutation } from "@/lib/api/query/useDeleteUploadMutation.js";

const getFileIcon = (contentType: UploadDTO["contentType"]) => {
	switch (contentType) {
		case "PDF":
			return <PictureAsPdfIcon />;
		case "DOCX":
			return <DescriptionIcon />;
	}
};

const ParseStatusIcon = ({ status }: { status: ParseStatus }) => {
	switch (status) {
		case "completed":
			return (
				<Box
					component="span"
					title="CV parsed successfully"
					sx={{ display: "flex", alignItems: "center", cursor: "default" }}
				>
					<CheckIcon sx={{ fontSize: 16, color: "success.500" }} />
				</Box>
			);
		case "pending":
		case "processing":
			return (
				<Box
					component="span"
					title="Parsing CV..."
					sx={{ display: "flex", alignItems: "center", cursor: "default" }}
				>
					<CircularProgress
						size="sm"
						sx={{ "--CircularProgress-size": "14px" }}
					/>
				</Box>
			);
		case "failed":
			return (
				<Box
					component="span"
					title="Failed to parse CV"
					sx={{ display: "flex", alignItems: "center", cursor: "default" }}
				>
					<ErrorOutlineIcon sx={{ fontSize: 16, color: "danger.500" }} />
				</Box>
			);
	}
};

interface UploadItemProps {
	upload: UploadDTO;
}

export function UploadItem({ upload }: UploadItemProps) {
	const deleteUploadMutation = useDeleteUploadMutation();

	const handleDelete = () => {
		deleteUploadMutation.mutate(upload.fileId);
	};

	return (
		<Alert
			variant="soft"
			color="neutral"
			startDecorator={getFileIcon(upload.contentType)}
			endDecorator={
				<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
					<ParseStatusIcon status={upload.parseStatus} />
					<IconButton
						size="sm"
						variant="plain"
						color="neutral"
						onClick={handleDelete}
						disabled={deleteUploadMutation.isPending}
						sx={{ minHeight: 0, minWidth: 0, padding: 0 }}
					>
						<CloseIcon sx={{ fontSize: 16 }} />
					</IconButton>
				</Box>
			}
			size="sm"
		>
			<BodyExtraSmall>{upload.originalFilename}</BodyExtraSmall>
		</Alert>
	);
}
