import { useQuery } from "@tanstack/react-query";
import { type CvWindowBalanceResponse, getCvWindowBalance } from "../api.js";
import { cvWindowBalanceKeys } from "../queryKeys.js";

export const useCvWindowBalanceQuery = () => {
	return useQuery<CvWindowBalanceResponse, Error>({
		queryKey: cvWindowBalanceKeys.all,
		queryFn: getCvWindowBalance,
		staleTime: 0,
		gcTime: 0,
		refetchOnMount: true,
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
		throwOnError: (error) => {
			console.error("Failed to load CV window balance:", error);
			return false;
		},
	});
};
