import { SUCCESS_AND_UNFINISHED_PARSE_STATUSES } from "@lazyapply/types";
import type { UseQueryResult } from "@tanstack/react-query";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
} from "react";
import type { GetUploadsResponse, UploadDTO } from "../api.js";
import { useUpdateSelectedUploadMutation } from "../query/useUpdateSelectedUploadMutation.js";
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
	const updateSelectedUploadMutation = useUpdateSelectedUploadMutation();

	// Refetch uploads when tab gains focus
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				refetch();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [refetch]);

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

	const setSelectedUpload = useCallback(
		(upload: EnhancedUploadDTO | null) => {
			updateSelectedUploadMutation.mutate(upload?._id ?? null);
		},
		[updateSelectedUploadMutation],
	);

	const { activeUploads, failedUploads, readyUploads, selectedUpload } =
		useMemo(() => {
			const active: EnhancedUploadDTO[] = [];
			const failed: EnhancedUploadDTO[] = [];
			const ready: EnhancedUploadDTO[] = [];
			let selected: EnhancedUploadDTO | null = null;

			// Determine which upload is selected (explicit preference or fallback to first)
			const selectedId = data?.selectedUploadId ?? uploads[0]?._id;

			for (const upload of uploads) {
				if (upload._id === selectedId) {
					selected = upload;
					continue;
				}

				upload.isActive ? active.push(upload) : failed.push(upload);

				if (upload.isParsed) {
					ready.push(upload);
				}
			}

			return {
				activeUploads: active,
				failedUploads: failed,
				readyUploads: ready,
				selectedUpload: selected,
			};
		}, [uploads, data?.selectedUploadId]);
	console.log({ selectedUpload });
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
			setSelectedUpload,
			data?.total,
			isLoading,
			error,
			refetch,
		],
	);
	console.log({ value });
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
