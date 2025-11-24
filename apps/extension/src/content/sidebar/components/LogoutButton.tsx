import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import IconButton from "@mui/joy/IconButton";
import React from "react";

interface LogoutButtonProps {
	onSignOut: () => void;
}

export function LogoutButton({ onSignOut }: LogoutButtonProps) {
	return (
		<IconButton
			size="md"
			variant="plain"
			color="neutral"
			sx={{
				"&:hover": {
					backgroundColor: "transparent",
					transition: "transform 0.3s ease",
					transform: "translateX(4px)",
				},
			}}
			onClick={onSignOut}
		>
			<LogoutRoundedIcon />
		</IconButton>
	);
}
