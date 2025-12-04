import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import { BodySmall } from "@/components/Typography.js";

interface LoadingIndicatorProps {
	loading: boolean;
}

export function LoadingIndicator({ loading }: LoadingIndicatorProps) {
	if (!loading) return null;

	return (
		<Stack direction="row" spacing={1.5} alignItems="center">
			<CircularProgress size="sm" determinate={false} />
			<BodySmall sx={{ color: "neutral.500" }}>Working…</BodySmall>
		</Stack>
	);
}
