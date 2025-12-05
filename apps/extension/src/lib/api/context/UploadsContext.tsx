import { SUCCESS_AND_UNFINISHED_PARSE_STATUSES } from "@lazyapply/types";
import type { UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { GetUploadsResponse, UploadDTO } from "../api.js";
import { useUploadsQuery } from "../query/useUploadsQuery.js";

export type EnhancedUploadDTO = UploadDTO & {
	isParsed: boolean;
	isActive: boolean;
};

interface UploadsContextValue {
	uploads: EnhancedUploadDTO[];
	activeUploads: EnhancedUploadDTO[];
	failedUploads: EnhancedUploadDTO[];
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

	const uploads = useMemo(() => {
		const rawUploads = data?.uploads ?? [];
		const activeStatuses: readonly string[] =
			SUCCESS_AND_UNFINISHED_PARSE_STATUSES;

		// Enhance with isParsed and isActive prop and sort by createdAt desc
		return rawUploads
			.map((upload) => ({
				...upload,
				isParsed:
					upload.status === "uploaded" && upload.parseStatus === "completed",
				isActive:
					upload.status === "uploaded" &&
					activeStatuses.includes(upload.parseStatus),
			}))
			.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
	}, [data]);

	const { activeUploads, failedUploads, readyUploads } = useMemo(() => {
		const activeUploads = [];
		const failedUploads = [];
		const readyUploads = [];
		for (const upload of uploads) {
			if (upload.fileId === selectedUpload?.fileId) {
				continue;
			}

			upload.isActive ? activeUploads.push(upload) : failedUploads.push(upload);

			upload.isParsed ?? readyUploads.push(upload);
		}

		return { activeUploads, failedUploads, readyUploads };
	}, [uploads, selectedUpload]);

	// Sync selectedUpload with fresh data from uploads when polling updates arrive
	const selectedUploadId = selectedUpload?.fileId;
	useEffect(() => {
		if (selectedUploadId) {
			// If current selection still exists, update it with fresh data
			const stillExists = uploads.find(
				(upload) => upload.fileId === selectedUploadId,
			);
			if (stillExists) {
				// Update with fresh data to reflect status changes from polling
				setSelectedUpload(stillExists);
				return;
			}
		}
		// Default to first upload
		setSelectedUpload(uploads[0] ?? null);
	}, [uploads, selectedUploadId]);

	const value = useMemo<UploadsContextValue>(
		() => ({
			uploads,
			activeUploads,
			failedUploads,
			readyUploads,
			selectedUpload,
			setSelectedUpload,
			isSelectedReady: selectedUpload?.isParsed ?? false,
			hasUploads: uploads.length > 0,
			hasReadyUploads: readyUploads.length > 0,
			total: data?.total ?? 0,
			isLoading,
			error,
			refetch,
		}),
		[
			uploads,
			activeUploads,
			failedUploads,
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
