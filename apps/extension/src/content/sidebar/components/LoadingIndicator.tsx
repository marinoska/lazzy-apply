import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import React from "react";

interface LoadingIndicatorProps {
	loading: boolean;
}

export function LoadingIndicator({ loading }: LoadingIndicatorProps) {
	if (!loading) return null;

	return (
		<Stack direction="row" spacing={1.5} alignItems="center">
			<CircularProgress size="sm" determinate={false} />
			<Typography level="body-sm" color="neutral">
				Working…
			</Typography>
		</Stack>
	);
}
