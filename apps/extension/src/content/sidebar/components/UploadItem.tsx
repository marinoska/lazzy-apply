import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import { BodyExtraSmall } from "@/components/Typography.js";
import type { UploadDTO } from "@/lib/api/api.js";
import { useDeleteUploadMutation } from "@/lib/api/query/useDeleteUploadMutation.js";
import { StatusChip } from "./StatusIcon.js";

const getFileIcon = (contentType: UploadDTO["contentType"]) => {
	switch (contentType) {
		case "PDF":
			return <PictureAsPdfIcon />;
		case "DOCX":
			return <DescriptionIcon />;
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
					<StatusChip upload={upload} />
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
