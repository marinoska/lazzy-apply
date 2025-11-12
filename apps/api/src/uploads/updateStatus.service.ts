import { createHash } from "node:crypto";

import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";

import { getCloudflareClient } from "@/app/cloudflare.js";
import {
	MAXIMUM_UPLOAD_SIZE_BYTES,
	QUARANTINE_DIRECTORY,
	UPLOAD_DIRECTORY,
	type UploadStatus,
} from "@/routes/uploads/constants.js";
import {
	type FileUploadDocument,
	FileUploadModel,
} from "@/uploads/fileUpload.model.js";

type CompleteUploadPayload = {
	fileId: string;
	status: UploadStatus;
	deduplicated?: boolean;
};

type PromoteUploadResult = {
	newObjectKey: string;
	fileHash: string;
	size: number;
};

const fetchHeadObject = async (
	bucket: string,
	objectKey: string,
): Promise<HeadObjectCommandOutput | undefined> => {
	try {
		const headCommand = new HeadObjectCommand({
			Bucket: bucket,
			Key: objectKey,
		});

		return await getCloudflareClient().send(headCommand);
	} catch {
		return undefined;
	}
};

const deleteRemoteObject = async (bucket: string, objectKey: string) => {
	const deleteCommand = new DeleteObjectCommand({
		Bucket: bucket,
		Key: objectKey,
	});

	await getCloudflareClient().send(deleteCommand);
};

const hashRemoteObject = async (
	bucket: string,
	objectKey: string,
): Promise<string | undefined> => {
	const getCommand = new GetObjectCommand({
		Bucket: bucket,
		Key: objectKey,
	});
	const getResult = await getCloudflareClient().send(getCommand);

	if (!getResult.Body) {
		return undefined;
	}

	const hash = createHash("sha256");
	const stream = getResult.Body as NodeJS.ReadableStream;

	for await (const chunk of stream) {
		hash.update(chunk);
	}

	return hash.digest("hex");
};

/**
 * Promotes a file from quarantine to the healthy directory
 * Returns the new object key and file metadata
 */
const promoteFromQuarantine = async (
	bucket: string,
	quarantineKey: string,
	fileId: string,
): Promise<PromoteUploadResult> => {
	const healthyKey = `${UPLOAD_DIRECTORY}/${fileId}`;

	// Copy from quarantine to healthy directory
	const copyCommand = new CopyObjectCommand({
		Bucket: bucket,
		CopySource: `${bucket}/${quarantineKey}`,
		Key: healthyKey,
	});

	await getCloudflareClient().send(copyCommand);

	// Get file metadata and hash from the new location
	const headResult = await fetchHeadObject(bucket, healthyKey);
	if (!headResult?.ContentLength) {
		throw new Error("Failed to verify promoted file");
	}

	const fileHash = await hashRemoteObject(bucket, healthyKey);
	if (!fileHash) {
		throw new Error("Failed to hash promoted file");
	}

	// Delete from quarantine
	await deleteRemoteObject(bucket, quarantineKey);

	return {
		newObjectKey: healthyKey,
		fileHash,
		size: headResult.ContentLength,
	};
};

/**
 * Validates and processes an upload from quarantine
 * Checks file existence, size, and handles deduplication
 */
const validateAndPromoteUpload = async (
	fileUpload: FileUploadDocument,
): Promise<CompleteUploadPayload> => {
	// Check if file exists in quarantine
	const headResult = await fetchHeadObject(
		fileUpload.bucket,
		fileUpload.objectKey,
	);

	if (!headResult?.ContentLength) {
		// File doesn't exist in quarantine - upload still in progress or failed
		throw new Error(
			"Upload not found in quarantine - still in progress or failed",
		);
	}

	const actualSize = headResult.ContentLength;

	// Validate file size
	if (actualSize > MAXIMUM_UPLOAD_SIZE_BYTES) {
		await deleteRemoteObject(fileUpload.bucket, fileUpload.objectKey);

		await fileUpload.markAsFailed();

		throw new Error(
			`File size (${actualSize} bytes) exceeds maximum allowed size (${MAXIMUM_UPLOAD_SIZE_BYTES} bytes)`,
		);
	}

	// Hash file in quarantine for deduplication check
	const fileHash = await hashRemoteObject(
		fileUpload.bucket,
		fileUpload.objectKey,
	);

	if (!fileHash) {
		throw new Error("Failed to hash file in quarantine");
	}

	// Check for existing file with same hash for this user
	// Include both "uploaded" and "deduplicated" statuses
	let existingFile =
		await FileUploadModel.findExistingCompletedUploadByHash({
			fileHash,
			excludeFileId: fileUpload.fileId,
			userId: fileUpload.userId,
		});

	// If we found a deduplicated file, follow the chain to get the original
	if (
		existingFile?.status === "deduplicated" &&
		existingFile.deduplicatedFrom
	) {
		existingFile = await FileUploadModel.findUploadedByFileId(
			existingFile.deduplicatedFrom,
			{ userId: fileUpload.userId },
		);
	}

	if (existingFile) {
		// Deduplicate - delete from quarantine and reference existing file
		await deleteRemoteObject(fileUpload.bucket, fileUpload.objectKey);

		await fileUpload.markAsDeduplicated({
			deduplicatedFrom: existingFile.fileId,
			fileHash,
			size: actualSize,
		});

		return {
			fileId: existingFile.fileId,
			status: "deduplicated",
		};
	}

	// Promote file from quarantine to healthy directory
	const {
		newObjectKey,
		fileHash: verifiedHash,
		size,
	} = await promoteFromQuarantine(
		fileUpload.bucket,
		fileUpload.objectKey,
		fileUpload.fileId,
	);

	// Extract directory from the new object key (e.g., "cv/fileId" -> "cv")
	const directory = newObjectKey.split("/")[0] || "";

	// Update database with new location, directory, hash, and status
	const updatedFileUpload = await fileUpload.markAsUploaded({
		objectKey: newObjectKey,
		directory,
		fileHash: verifiedHash,
		size,
	});

	if (!updatedFileUpload) {
		throw new Error(`Upload ${fileUpload.fileId} was not found for this user`);
	}

	return {
		fileId: updatedFileUpload.fileId,
		status: "uploaded",
	};
};

/**
 * Completes an upload by validating the file in quarantine and promoting it to healthy directory
 * This should be called when the client signals upload completion
 * Throws error if file is not ready (still uploading) - client should retry
 */
export const completeUpload = async (
	fileUpload: FileUploadDocument,
): Promise<CompleteUploadPayload> => {
	return await validateAndPromoteUpload(fileUpload);
};
