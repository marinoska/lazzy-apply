import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { Box } from "@mui/joy";
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
	isActive: boolean;
	onSelect: (fileId: string) => void;
	isTopItem?: boolean;
}

function CVItem({
	upload,
	isActive,
	onSelect,
	isTopItem = false,
}: CVItemProps) {
	const deleteUploadMutation = useDeleteUploadMutation();
	const isSelectable = upload.isReady;

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		deleteUploadMutation.mutate(upload.fileId);
	};

	const handleClick = () => {
		if (isSelectable && !isActive) {
			onSelect(upload.fileId);
		}
	};

	const FilenameComponent = isTopItem ? BodyExtraSmallDarker : BodyExtraSmall;

	return (
		<Sheet
			variant="soft"
			color={isActive ? "primary" : "neutral"}
			onClick={handleClick}
			sx={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 1,
				p: 1,
				borderRadius: "sm",
				cursor: isSelectable && !isActive ? "pointer" : "default",
				opacity: isSelectable ? 1 : 0.6,
				transition: "all 0.2s ease",
				"&:hover":
					isSelectable && !isActive
						? {
								backgroundColor: "neutral.softHoverBg",
							}
						: {},
			}}
		>
			<Stack direction="row" alignItems="center" gap={1}>
				{getFileIcon(upload.contentType)}
				<FilenameComponent>{upload.originalFilename}</FilenameComponent>
			</Stack>
			<Stack direction="row" alignItems="center" gap={0.5}>
				<StatusChip upload={upload} />
				{!isTopItem && (
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
				)}
			</Stack>
		</Sheet>
	);
}

interface OtherUploadsProps {
	otherUploads: EnhancedUploadDTO[];
	isExpanded: boolean;
	onToggleExpanded: () => void;
	onSelect: (fileId: string) => void;
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
				justifyContent="right"
				gap={1}
				px={2}
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
				<ExpandMoreIcon
					sx={{
						fontSize: 30,
						color: "neutral.500",
						transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
						transition: "transform 0.2s ease",
					}}
				/>
				<BodySmallDarker>Select your CV</BodySmallDarker>
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
								isActive={false}
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

interface CVSelectorProps {
	activeFileId: string | null;
	onActiveChange: (fileId: string) => void;
}

export function CVSelector({ activeFileId, onActiveChange }: CVSelectorProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const { uploads, topUpload, isLoading, error } = useUploads();

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

	if (uploads.length === 0) {
		return null;
	}

	// Determine the active upload: use activeFileId if it's a ready upload, otherwise use topUpload
	const activeUpload = activeFileId
		? (uploads.find((u) => u.fileId === activeFileId && u.isReady) ?? topUpload)
		: topUpload;

	// Other uploads (excluding active)
	const otherUploads = uploads.filter((u) => u.fileId !== activeUpload?.fileId);

	const handleSelect = (fileId: string) => {
		onActiveChange(fileId);
	};

	const toggleExpanded = () => {
		setIsExpanded((prev) => !prev);
	};

	return (
		<Stack direction="column" spacing={1}>
			{/* Top upload (ready or latest) */}
			{activeUpload && (
				<CVItem
					upload={activeUpload}
					isActive={true}
					onSelect={handleSelect}
					isTopItem
				/>
			)}

			{/* Collapsible section for other CVs - only show if more than one CV */}
			{otherUploads.length > 0 && uploads.length > 1 && (
				<OtherUploads
					otherUploads={otherUploads}
					isExpanded={isExpanded}
					onToggleExpanded={toggleExpanded}
					onSelect={handleSelect}
				/>
			)}
		</Stack>
	);
}
