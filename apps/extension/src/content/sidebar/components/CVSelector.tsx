import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import { useState } from "react";
import { AppAlert } from "@/components/AppAlert.js";
import { LoadingState } from "@/components/QueryState.js";
import { Snackbar } from "@/components/Snackbar.js";
import { BodyExtraSmall, BodySmall } from "@/components/Typography.js";
import type { ParseStatus, UploadDTO } from "@/lib/api/api.js";
import { useDeleteUploadMutation } from "@/lib/api/query/useDeleteUploadMutation.js";
import { useUploadsQuery } from "@/lib/api/query/useUploadsQuery.js";

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
		case "pending":
			return null;
	}
};

interface CVItemProps {
	upload: UploadDTO;
	isActive: boolean;
	onSelect: (fileId: string) => void;
	showDecorators?: boolean;
}

function CVItem({
	upload,
	isActive,
	onSelect,
	showDecorators = true,
}: CVItemProps) {
	const deleteUploadMutation = useDeleteUploadMutation();
	const isSelectable = upload.parseStatus === "completed";

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		deleteUploadMutation.mutate(upload.fileId);
	};

	const handleClick = () => {
		if (isSelectable && !isActive) {
			onSelect(upload.fileId);
		}
	};

	return (
		<Alert
			variant="soft"
			color={isActive ? "primary" : "neutral"}
			startDecorator={
				showDecorators ? getFileIcon(upload.contentType) : undefined
			}
			endDecorator={
				showDecorators ? (
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
				) : undefined
			}
			size="sm"
			onClick={handleClick}
			sx={{
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
			<BodyExtraSmall>{upload.originalFilename}</BodyExtraSmall>
		</Alert>
	);
}

interface CVSelectorProps {
	activeFileId: string | null;
	onActiveChange: (fileId: string) => void;
}

export function CVSelector({ activeFileId, onActiveChange }: CVSelectorProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const { data, isLoading, error } = useUploadsQuery({ limit: 20 });

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

	if (!data?.uploads || data.uploads.length === 0) {
		return null;
	}

	const uploads = data.uploads;
	const successfulUploads = uploads.filter(
		(u) => u.parseStatus === "completed",
	);

	// Determine the active upload
	const activeUpload = activeFileId
		? uploads.find(
				(u) => u.fileId === activeFileId && u.parseStatus === "completed",
			)
		: successfulUploads[0];

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
			{/* Active CV at top */}
			{activeUpload && (
				<CVItem
					upload={activeUpload}
					isActive={true}
					onSelect={handleSelect}
					showDecorators={false}
				/>
			)}

			{/* Collapsible section for other CVs - only show if more than one CV */}
			{otherUploads.length > 0 && uploads.length > 1 && (
				<>
					<Box
						onClick={toggleExpanded}
						sx={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 0.5,
							cursor: "pointer",
							userSelect: "none",
							py: 0.5,
							transition: "transform 0.2s ease",
							"&:hover": {
								transform: "scale(1.05)",
								backgroundColor: "neutral.100",
							},
							borderRadius: "sm",
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
						<BodySmall sx={{ color: "neutral.600" }}>Select your CV</BodySmall>
					</Box>

					<Box
						sx={{
							display: "grid",
							gridTemplateRows: isExpanded ? "1fr" : "0fr",
							transition: "grid-template-rows 0.3s ease-out",
						}}
					>
						<Box sx={{ overflow: "hidden" }}>
							<Stack
								direction="column"
								spacing={1}
								sx={{ pb: isExpanded ? 0 : 0 }}
							>
								{otherUploads.map((upload) => (
									<CVItem
										key={upload.fileId}
										upload={upload}
										isActive={false}
										onSelect={handleSelect}
									/>
								))}
							</Stack>
						</Box>
					</Box>
					<Divider orientation="horizontal" color="border" />
				</>
			)}
		</Stack>
	);
}
