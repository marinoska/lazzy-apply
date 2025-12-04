import type { ClientSession, Schema } from "mongoose";

import { createLogger } from "@/app/logger.js";
import type {
	CreatePendingUploadParams,
	FileUploadDocument,
	FileUploadMethods,
	FileUploadModelBase,
	FindExistingUploadByHashParams,
	OwnershipContext,
	TFileUpload,
} from "./fileUpload.types.js";

const log = createLogger("FileUploadStatics");

/**
 * Upload statuses that allow canonical replacement.
 * These indicate the previous upload attempt is no longer valid.
 */
export const REPLACEABLE_STATUSES = [
	"failed",
	"rejected",
	"deleted-by-user",
] as const;

/**
 * Upload statuses that block new uploads (active canonical exists).
 * - pending: upload in progress
 * - uploaded: completed upload exists
 *
 * Note: deduplicated is NOT a blocking status because deduplicated uploads
 * cannot be canonical (enforced by schema validator).
 */
export const BLOCKING_STATUSES = ["pending", "uploaded"] as const;

export type ReplaceableStatus = (typeof REPLACEABLE_STATUSES)[number];
export type BlockingStatus = (typeof BLOCKING_STATUSES)[number];

/** Check if a status allows canonical replacement. */
export const isReplaceableStatus = (
	status: string,
): status is ReplaceableStatus => {
	return (REPLACEABLE_STATUSES as readonly string[]).includes(status);
};

/** Check if a status blocks new uploads. */
export const isBlockingStatus = (status: string): status is BlockingStatus => {
	return (BLOCKING_STATUSES as readonly string[]).includes(status);
};

export type FindCanonicalParams = {
	fileHash: string;
	userId: string;
	session?: ClientSession;
};

export type ResolveAndClaimCanonicalParams = {
	fileHash: string;
	excludeFileId: string;
	userId: string;
};

export type CanonicalResolutionResult =
	| {
			action: "become_canonical";
			previousCanonical?: FileUploadDocument;
	  }
	| {
			action: "deduplicate";
			canonicalUpload: FileUploadDocument;
	  };

export type FileUploadStatics = {
	createPendingUpload(
		this: FileUploadModelWithStatics,
		payload: CreatePendingUploadParams,
	): Promise<FileUploadDocument>;
	findPendingUpload(
		this: FileUploadModelWithStatics,
		fileId: string,
		userId: string,
	): Promise<FileUploadDocument | null>;
	findExistingCompletedUploadByHash(
		this: FileUploadModelWithStatics,
		params: FindExistingUploadByHashParams,
	): Promise<FileUploadDocument | null>;
	findUploadedByFileId(
		this: FileUploadModelWithStatics,
		fileId: string,
		ownership: OwnershipContext,
	): Promise<FileUploadDocument | null>;
	findStalePendingUploads(
		this: FileUploadModelWithStatics,
		cutoff: Date,
		limit: number,
	): Promise<FileUploadDocument[]>;
	findDeletableByFileId(
		this: FileUploadModelWithStatics,
		fileId: string,
		userId: string,
	): Promise<FileUploadDocument | null>;
	findCanonical(
		this: FileUploadModelWithStatics,
		params: FindCanonicalParams,
	): Promise<FileUploadDocument | null>;
	resolveAndClaimCanonical(
		this: FileUploadModelWithStatics,
		params: ResolveAndClaimCanonicalParams,
		session: ClientSession,
	): Promise<CanonicalResolutionResult>;
};

export type FileUploadModelWithStatics = FileUploadModelBase &
	FileUploadStatics;

export const registerFileUploadStatics = (
	schema: Schema<TFileUpload, FileUploadModelWithStatics, FileUploadMethods>,
) => {
	schema.statics.createPendingUpload = async function (payload) {
		return await this.create({
			...payload,
			status: "pending",
		});
	};

	schema.statics.findPendingUpload = async function (fileId, userId) {
		return await this.findOne({
			fileId,
			status: "pending",
		}).setOptions({ userId });
	};

	schema.statics.findExistingCompletedUploadByHash = async function (params) {
		return await this.findOne({
			fileHash: params.fileHash,
			status: { $in: ["uploaded", "deduplicated"] },
			fileId: { $ne: params.excludeFileId },
		}).setOptions({ userId: params.userId });
	};

	schema.statics.findUploadedByFileId = async function (fileId, ownership) {
		return await this.findOne({
			fileId,
			status: "uploaded",
		}).setOptions(ownership);
	};

	schema.statics.findStalePendingUploads = async function (cutoff, limit) {
		return await this.find({
			status: "pending",
			createdAt: { $lt: cutoff },
		})
			.setOptions({ skipOwnershipEnforcement: true })
			.sort({ createdAt: 1 })
			.limit(limit)
			.exec();
	};

	schema.statics.findDeletableByFileId = async function (fileId, userId) {
		return await this.findOne({
			fileId,
			status: { $ne: "deleted-by-user" },
		}).setOptions({ userId });
	};

	schema.statics.findCanonical = async function (params) {
		const query = this.findOne({
			fileHash: params.fileHash,
			isCanonical: true,
		}).setOptions({ userId: params.userId });

		if (params.session) {
			query.session(params.session);
		}

		return await query;
	};

	/**
	 * Atomically resolve and claim canonical status within a transaction.
	 * Prevents race conditions by doing read + write in one atomic operation.
	 */
	schema.statics.resolveAndClaimCanonical = async function (params, session) {
		const { fileHash, excludeFileId, userId } = params;

		// Find canonical within transaction (uses snapshot isolation)
		const canonical = await this.findCanonical({ fileHash, userId, session });

		// No canonical exists - new upload becomes canonical
		if (!canonical) {
			log.debug(
				{ fileHash, excludeFileId },
				"No canonical found, new upload becomes canonical",
			);
			return { action: "become_canonical" };
		}

		// Canonical exists but is the same upload
		if (canonical.fileId === excludeFileId) {
			log.warn(
				{ fileHash, fileId: excludeFileId },
				"Canonical lookup returned same fileId - treating as become_canonical",
			);
			return { action: "become_canonical" };
		}

		// Check if canonical can be replaced (failed/rejected/deleted-by-user)
		const replaceableStatuses = ["failed", "rejected", "deleted-by-user"];
		if (replaceableStatuses.includes(canonical.status)) {
			log.info(
				{
					fileHash,
					previousFileId: canonical.fileId,
					previousStatus: canonical.status,
					newFileId: excludeFileId,
				},
				"Replacing canonical upload atomically",
			);

			// Atomically revoke previous canonical within same transaction
			// skipImmutabilityCheck allows updating isCanonical on terminal-state documents
			// skipOwnershipEnforcement is safe here because we already verified ownership via findCanonical
			await this.updateOne(
				{ _id: canonical._id },
				{ $set: { isCanonical: false } },
				{ session },
			).setOptions({
				skipImmutabilityCheck: true,
				skipOwnershipEnforcement: true,
			});

			return {
				action: "become_canonical",
				previousCanonical: canonical,
			};
		}

		// Canonical exists with blocking status - deduplicate
		log.info(
			{
				fileHash,
				canonicalFileId: canonical.fileId,
				canonicalStatus: canonical.status,
				newFileId: excludeFileId,
			},
			"Deduplicating against existing canonical",
		);
		return {
			action: "deduplicate",
			canonicalUpload: canonical,
		};
	};
};
