import { UNFINISHED_PARSE_STATUSES } from "@lazyapply/types";
import { useQuery } from "@tanstack/react-query";
import {
	type GetUploadsParams,
	type GetUploadsResponse,
	getUploads,
} from "../api.js";
import { uploadsKeys } from "../queryKeys.js";

const AGGRESSIVE_POLL_INTERVAL_MS = 1500;
const MODERATE_POLL_INTERVAL_MS = 5000;
const SLOW_POLL_INTERVAL_MS = 60000;
const AGGRESSIVE_POLL_DURATION_MS = 5 * 60 * 1000; // 5 min
const MODERATE_POLL_DURATION_MS = 10 * 60 * 1000; // 10 min total
const MAX_POLL_DURATION_MS = 20 * 60 * 1000; // 20 min - stop polling

const hasUnfinishedUploads = (
	data: GetUploadsResponse | undefined,
): boolean => {
	if (!data?.uploads) return false;
	return data.uploads.some(
		(upload) =>
			upload.status === "uploaded" &&
			(UNFINISHED_PARSE_STATUSES as readonly string[]).includes(
				upload.parseStatus,
			),
	);
};

const TIMES_THREE = 3;

const getPollInterval = (
	data: GetUploadsResponse | undefined,
	dataUpdatedAt: number,
): number | false => {
	if (!hasUnfinishedUploads(data)) return false;

	const pollingDuration = Date.now() - dataUpdatedAt;
	if (pollingDuration > MAX_POLL_DURATION_MS) {
		return false;
	}
	if (pollingDuration > MODERATE_POLL_DURATION_MS) {
		return SLOW_POLL_INTERVAL_MS;
	}
	if (pollingDuration > AGGRESSIVE_POLL_DURATION_MS) {
		return MODERATE_POLL_INTERVAL_MS;
	}
	return AGGRESSIVE_POLL_INTERVAL_MS;
};

export const useUploadsQuery = (params: GetUploadsParams = {}) => {
	return useQuery<GetUploadsResponse, Error>({
		queryKey: uploadsKeys.list(params),
		queryFn: async () => getUploads(params),
		retry: TIMES_THREE,
		refetchOnWindowFocus: true,
		refetchInterval: (query) =>
			getPollInterval(query.state.data, query.state.dataUpdatedAt),
		throwOnError: (error) => {
			console.error("Failed to load uploads:", error);
			return false;
		},
	});
};
