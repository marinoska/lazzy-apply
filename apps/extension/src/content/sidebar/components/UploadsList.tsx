import Stack from "@mui/joy/Stack";
import { LoadingState, ErrorState } from "@/components/QueryState.js";
import { useUploadsQuery } from "@/hooks/useUploadsQuery.js";
import { UploadItem } from "./UploadItem.js";

export function UploadsList() {
	const { data, isLoading, error } = useUploadsQuery({ limit: 5 });

	if (isLoading) {
		return <LoadingState />;
	}

	if (error) {
		return <ErrorState message="Failed to load uploads" />;
	}

	if (!data?.uploads || data.uploads.length === 0) {
		return null;
	}

	return (
		<Stack direction="column" spacing={1}>
			{data.uploads.map((upload) => (
				<UploadItem key={upload.fileId} upload={upload} />
			))}
		</Stack>
	);
}
