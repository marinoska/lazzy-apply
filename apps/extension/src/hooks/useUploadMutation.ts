import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	completeUpload,
	getUploadSignedUrl,
	uploadFileToSignedUrl,
	type CompleteUploadResponse,
} from "../lib/api/api.js";
import { uploadsKeys } from "../lib/api/queryKeys.js";

interface UploadParams {
	file: File;
}

export const useUploadMutation = () => {
	const queryClient = useQueryClient();

	return useMutation<CompleteUploadResponse, Error, UploadParams>({
		mutationFn: async ({ file }: UploadParams) => {
			// Get signed URL from API
			const uploadDetails = await getUploadSignedUrl(
				file.name,
				file.type,
				file.size,
			);

			// Upload file to signed URL
			await uploadFileToSignedUrl(file, uploadDetails);

			// Signal completion - server validates and promotes from quarantine
			return completeUpload(uploadDetails.fileId);
		},
		onSuccess: () => {
			// Invalidate uploads query to refetch the list
			queryClient.invalidateQueries({ queryKey: uploadsKeys.lists() });
		},
	});
};
