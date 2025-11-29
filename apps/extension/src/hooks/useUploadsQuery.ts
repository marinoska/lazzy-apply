import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	getUploads,
	type GetUploadsParams,
	type GetUploadsResponse,
} from "../lib/api/api.js";
import { uploadsKeys } from "../lib/api/queryKeys.js";

const TIMES_THREE = 3;

export const useUploadsQuery = (params: GetUploadsParams = {}) => {
	return useQuery<GetUploadsResponse, Error>({
		queryKey: uploadsKeys.list(params),
		queryFn: async () => getUploads(params),
		retry: TIMES_THREE,
	});
};
