import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import { BodySmall } from "@/components/Typography.js";

export function LoadingState() {
	return (
		<Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
			<CircularProgress size="sm" />
		</Box>
	);
}

interface ErrorStateProps {
	message?: string;
}

export function ErrorState({
	message = "Something went wrong",
}: ErrorStateProps) {
	return <BodySmall sx={{ color: "danger.500" }}>{message}</BodySmall>;
}
