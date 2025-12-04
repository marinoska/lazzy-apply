import type { UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { GetUploadsResponse, UploadDTO } from "../api.js";
import { useUploadsQuery } from "../query/useUploadsQuery.js";

export type EnhancedUploadDTO = UploadDTO & { isReady: boolean };

interface UploadsContextValue {
	uploads: EnhancedUploadDTO[];
	readyUploads: EnhancedUploadDTO[];
	selectedUpload: EnhancedUploadDTO | null;
	setSelectedUpload: (upload: EnhancedUploadDTO | null) => void;
	isSelectedReady: boolean;
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
	const [selectedUpload, setSelectedUpload] =
		useState<EnhancedUploadDTO | null>(null);

	const { uploads, readyUploads } = useMemo(() => {
		const rawUploads = data?.uploads ?? [];

		// Enhance with isReady prop (already sorted by createdAt desc from server)
		const uploads: EnhancedUploadDTO[] = rawUploads.map((upload) => ({
			...upload,
			isReady:
				upload.status === "uploaded" && upload.parseStatus === "completed",
		}));

		const readyUploads = uploads.filter((u) => u.isReady);

		return { uploads, readyUploads };
	}, [data]);

	// Set default selected upload when uploads load or change
	useEffect(() => {
		if (selectedUpload) {
			// If current selection still exists, keep it
			const stillExists = uploads.find(
				(u) => u.fileId === selectedUpload.fileId,
			);
			if (stillExists) {
				return;
			}
		}
		// Default to first upload
		setSelectedUpload(uploads[0] ?? null);
	}, [uploads, selectedUpload]);

	const value = useMemo<UploadsContextValue>(
		() => ({
			uploads,
			readyUploads,
			selectedUpload,
			setSelectedUpload,
			isSelectedReady: selectedUpload?.isReady ?? false,
			hasUploads: uploads.length > 0,
			hasReadyUploads: readyUploads.length > 0,
			total: data?.total ?? 0,
			isLoading,
			error,
			refetch,
		}),
		[
			uploads,
			readyUploads,
			selectedUpload,
			data?.total,
			isLoading,
			error,
			refetch,
		],
	);

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
