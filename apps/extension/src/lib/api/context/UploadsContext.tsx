import type { UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import type { GetUploadsResponse, UploadDTO } from "../api.js";
import { useUploadsQuery } from "../query/useUploadsQuery.js";

export type EnhancedUploadDTO = UploadDTO & { isReady: boolean };

interface UploadsContextValue {
	uploads: EnhancedUploadDTO[];
	readyUploads: EnhancedUploadDTO[];
	topUpload: EnhancedUploadDTO | null;
	hasUploads: boolean;
	hasReadyUploads: boolean;
	total: number;
	isLoading: boolean;
	error: Error | null;
	refetch: UseQueryResult<GetUploadsResponse, Error>["refetch"];
}

const UploadsContext = createContext<UploadsContextValue | null>(null);

interface UploadsProviderProps {
	children: React.ReactNode;
	limit?: number;
}

export function UploadsProvider({
	children,
	limit = 20,
}: UploadsProviderProps) {
	const { data, isLoading, error, refetch } = useUploadsQuery({ limit });

	const value = useMemo<UploadsContextValue>(() => {
		const rawUploads = data?.uploads ?? [];

		// Enhance with isReady prop (already sorted by createdAt desc from server)
		const uploads: EnhancedUploadDTO[] = rawUploads.map((upload) => ({
			...upload,
			isReady:
				upload.status === "uploaded" && upload.parseStatus === "completed",
		}));

		const readyUploads = uploads.filter((u) => u.isReady);

		// Top upload: first ready one if exists, otherwise the latest one
		const topUpload = readyUploads[0] ?? uploads[0] ?? null;

		return {
			uploads,
			readyUploads,
			topUpload,
			hasUploads: uploads.length > 0,
			hasReadyUploads: readyUploads.length > 0,
			total: data?.total ?? 0,
			isLoading,
			error,
			refetch,
		};
	}, [data, isLoading, error, refetch]);

	return (
		<UploadsContext.Provider value={value}>{children}</UploadsContext.Provider>
	);
}

export function useUploads(): UploadsContextValue {
	const context = useContext(UploadsContext);
	if (!context) {
		throw new Error("useUploads must be used within an UploadsProvider");
	}
	return context;
}
