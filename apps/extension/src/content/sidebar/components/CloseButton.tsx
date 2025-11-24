import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import IconButton from "@mui/joy/IconButton";
import React from "react";

interface CloseButtonProps {
	onClose: () => void;
}

export function CloseButton({ onClose }: CloseButtonProps) {
	return (
		<IconButton
			aria-label="Close"
			variant="plain"
			color="neutral"
			size="sm"
			onClick={onClose}
		>
			<CloseRoundedIcon />
		</IconButton>
	);
}
