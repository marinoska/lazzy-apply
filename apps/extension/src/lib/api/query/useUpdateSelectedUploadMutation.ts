import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GetUploadsResponse } from "../api.js";
import { updateSelectedUpload } from "../api.js";
import { uploadsKeys } from "../queryKeys.js";

export const useUpdateSelectedUploadMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (selectedUploadId: string | null) =>
			updateSelectedUpload(selectedUploadId),
		onSuccess: (data) => {
			// Optimistically update the uploads query cache
			queryClient.setQueriesData<GetUploadsResponse>(
				{ queryKey: uploadsKeys.lists() },
				(old) =>
					old ? { ...old, selectedUploadId: data.selectedUploadId } : undefined,
			);
		},
	});
};
