import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteUpload } from "@/lib/api/api.js";
import { uploadsKeys } from "@/lib/api/queryKeys.js";

export function useDeleteUploadMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (fileId: string) => deleteUpload(fileId),
		onSuccess: () => {
			// Invalidate uploads query to refresh the list
			queryClient.invalidateQueries({
				queryKey: uploadsKeys.lists(),
			});
		},
	});
}
