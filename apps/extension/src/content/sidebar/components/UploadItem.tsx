import Alert from "@mui/joy/Alert";
import IconButton from "@mui/joy/IconButton";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import CloseIcon from "@mui/icons-material/Close";
import type { UploadDTO } from "@/lib/api/api.js";
import { BodyExtraSmall } from "@/components/Typography.js";
import { useDeleteUploadMutation } from "@/lib/api/query/useDeleteUploadMutation.js";

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
			}
			size="sm"
		>
			<BodyExtraSmall>{upload.originalFilename}</BodyExtraSmall>
		</Alert>
	);
}
