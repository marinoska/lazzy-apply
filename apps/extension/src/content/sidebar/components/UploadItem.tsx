import Alert from "@mui/joy/Alert";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import type { UploadDTO } from "@/lib/api/api.js";
import { BodyExtraSmall } from "@/components/Typography.js";

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
	return (
		<Alert
			variant="soft"
			color="neutral"
			startDecorator={getFileIcon(upload.contentType)}
			size="sm"
		>
			<BodyExtraSmall>{upload.originalFilename}</BodyExtraSmall>
		</Alert>
	);
}
