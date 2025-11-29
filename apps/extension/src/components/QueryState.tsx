import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Typography from "@mui/joy/Typography";

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

export function ErrorState({ message = "Something went wrong" }: ErrorStateProps) {
	return (
		<Typography level="body-sm" color="danger">
			{message}
		</Typography>
	);
}
