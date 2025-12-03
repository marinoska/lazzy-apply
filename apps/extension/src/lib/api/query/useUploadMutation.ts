import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type UploadResponse, uploadFile } from "../api.js";
import { uploadsKeys } from "../queryKeys.js";

interface UploadParams {
	file: File;
}

export const useUploadMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<UploadResponse, Error, UploadParams>({
		mutationFn: async ({ file }: UploadParams) => {
			// Single upload call - Edge Function handles everything
			return uploadFile(file);
		},
		onSuccess: () => {
			// Invalidate uploads query to refetch the list
			queryClient.invalidateQueries({ queryKey: uploadsKeys.lists() });
		},
	});
};
