import Sheet from "@mui/joy/Sheet";
import React from "react";

interface StatusMessageProps {
	status: string | null;
}

export function StatusMessage({ status }: StatusMessageProps) {
	if (!status) return null;

	return (
		<Sheet
			variant="soft"
			color={status.startsWith("Failed") ? "danger" : "neutral"}
			sx={{
				borderRadius: "md",
				px: 1.5,
				py: 1,
				fontSize: "0.875rem",
			}}
		>
			{status}
		</Sheet>
	);
}
