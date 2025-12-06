import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { Box, Chip } from "@mui/joy";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { useState } from "react";
import { AppAlert } from "@/components/AppAlert.js";
import { LoadingState } from "@/components/QueryState.js";
import { Snackbar } from "@/components/Snackbar.js";
import {
	BodyExtraSmall,
	BodyExtraSmallDarker,
	BodySmallDarker,
} from "@/components/Typography.js";
import type { EnhancedUploadDTO } from "@/lib/api/context/UploadsContext.js";
import { useUploads } from "@/lib/api/context/UploadsContext.js";
import { useDeleteUploadMutation } from "@/lib/api/query/useDeleteUploadMutation.js";
import { StatusChip } from "./StatusIcon.js";

const getFileIcon = (contentType: EnhancedUploadDTO["contentType"]) => {
	switch (contentType) {
		case "PDF":
			return <PictureAsPdfIcon />;
		case "DOCX":
			return <DescriptionIcon />;
	}
};

interface CVItemProps {
	upload: EnhancedUploadDTO;
	isSelected: boolean;
	onSelect: (upload: EnhancedUploadDTO) => void;
	isTopItem?: boolean;
}

function CVItem({
	upload,
	isSelected,
	onSelect,
	isTopItem = false,
}: CVItemProps) {
	const deleteUploadMutation = useDeleteUploadMutation();
	const isSelectable = upload.isActive;

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		deleteUploadMutation.mutate(upload.fileId);
	};

	const handleClick = () => {
		if (isSelectable && !isSelected) {
			onSelect(upload);
		}
	};

	const FilenameComponent = isTopItem ? BodyExtraSmallDarker : BodyExtraSmall;

	return (
		<Sheet
			variant="soft"
			color={isSelected ? "success" : "neutral"}
			onClick={handleClick}
			sx={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 1,
				p: 1,
				borderRadius: "sm",
				cursor: isSelectable && !isSelected ? "pointer" : "default",
				opacity: isSelectable ? 1 : 0.6,
				transition: "all 0.2s ease",
				"&:hover":
					isSelectable && !isSelected
						? {
								backgroundColor: "neutral.softHoverBg",
								cursor: "pointer",
							}
						: {},
			}}
		>
			<Stack direction="row" alignItems="center" gap={1}>
				{getFileIcon(upload.contentType)}
				<Box>
					<FilenameComponent>{upload.originalFilename}</FilenameComponent>
					<BodyExtraSmall sx={{ color: "text.tertiary" }}>
						Uploaded on: {new Date(upload.createdAt).toLocaleDateString()}
					</BodyExtraSmall>
				</Box>
			</Stack>
			<Stack direction="row" alignItems="center" gap={0.5}>
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
			</Stack>
		</Sheet>
	);
}

interface OtherUploadsProps {
	otherUploads: EnhancedUploadDTO[];
	isExpanded: boolean;
	onToggleExpanded: () => void;
	onSelect: (upload: EnhancedUploadDTO) => void;
}

function OtherUploads({
	otherUploads,
	isExpanded,
	onToggleExpanded,
	onSelect,
}: OtherUploadsProps) {
	return (
		<>
			<Stack
				direction="row"
				onClick={onToggleExpanded}
				alignItems="center"
				justifyContent="space-between"
				gap={1}
				px={1.5}
				py={1}
				borderRadius="sm"
				sx={{
					cursor: "pointer",
					"&:hover": {
						transform: "scale(1.05)",
						backgroundColor: "neutral.100",
					},
				}}
			>
				<Stack direction="row" alignItems="center" gap={1}>
					<BodySmallDarker>Select another CV</BodySmallDarker>
					<Chip>{otherUploads.length}</Chip>
				</Stack>
				<ExpandMoreIcon
					sx={{
						fontSize: 30,
						color: "neutral.500",
						transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
						transition: "transform 0.2s ease",
					}}
				/>
			</Stack>

			<Box
				sx={{
					display: "grid",
					gridTemplateRows: isExpanded ? "1fr" : "0fr",
					transition: "grid-template-rows 0.3s ease-out",
				}}
			>
				<Stack sx={{ overflow: "hidden" }}>
					<Stack direction="column" spacing={1}>
						{otherUploads.map((upload) => (
							<CVItem
								key={upload.fileId}
								upload={upload}
								isSelected={false}
								onSelect={onSelect}
							/>
						))}
					</Stack>
				</Stack>
			</Box>
			<Divider orientation="horizontal" color="border" />
		</>
	);
}

export function CVSelector() {
	const [isExpanded, setIsExpanded] = useState(false);
	const {
		activeUploads,
		failedUploads,
		selectedUpload,
		setSelectedUpload,
		isLoading,
		error,
	} = useUploads();

	if (isLoading) {
		return <LoadingState />;
	}

	if (error) {
		return (
			<>
				<AppAlert type="error" />
				<Snackbar msg="Failed to load uploads" show={true} type="danger" />
			</>
		);
	}

	const otherCVCount = activeUploads.length + failedUploads.length;

	if (!otherCVCount && !selectedUpload) {
		return null;
	}

	return (
		<Stack direction="column" spacing={1}>
			{selectedUpload && (
				<CVItem
					upload={selectedUpload}
					isSelected={true}
					onSelect={setSelectedUpload}
					isTopItem
				/>
			)}

			{otherCVCount > 0 && (
				<OtherUploads
					otherUploads={[...activeUploads, ...failedUploads]}
					isExpanded={isExpanded}
					onToggleExpanded={() => setIsExpanded((prev) => !prev)}
					onSelect={setSelectedUpload}
				/>
			)}
		</Stack>
	);
}
