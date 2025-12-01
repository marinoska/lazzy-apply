import Stack from "@mui/joy/Stack";
import { AppAlert } from "@/components/AppAlert.js";
import { LoadingState } from "@/components/QueryState.js";
import { Snackbar } from "@/components/Snackbar.js";
import { useUploadsQuery } from "@/lib/api/query/useUploadsQuery.js";
import { UploadItem } from "./UploadItem.js";

export function UploadsList() {
	const { data, isLoading, error } = useUploadsQuery({ limit: 5 });

	if (isLoading) {
		return <LoadingState />;
	}

	if (error) {
		return (
			<>
				<AppAlert type="error" />
				<Snackbar
					msg="Failed to load uploads"
					show={true}
					type="danger"
				/>
			</>
		);
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
