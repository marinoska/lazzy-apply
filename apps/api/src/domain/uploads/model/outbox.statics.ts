import type { Schema } from "mongoose";

import type {
	OutboxMethods,
	OutboxModelWithStatics,
	TOutbox,
} from "./outbox.types.js";

export const registerOutboxStatics = (
	schema: Schema<TOutbox, OutboxModelWithStatics, OutboxMethods>,
) => {
	schema.statics.createOutbox = async function (payload) {
		return await this.create({
			...payload,
			status: "pending",
		});
	};

	schema.statics.createWithStatus = async function (
		original,
		status,
		error,
		usage,
	) {
		const newEntry: Partial<TOutbox> = {
			processId: original.processId,
			type: original.type,
			uploadId: original.uploadId,
			fileId: original.fileId,
			userId: original.userId,
			fileType: original.fileType,
			status,
		};

		if (error) {
			newEntry.error = error;
		}

		if (usage) {
			newEntry.promptTokens = usage.promptTokens;
			newEntry.completionTokens = usage.completionTokens;
			newEntry.totalTokens = usage.totalTokens;
			if (usage.inputCost !== undefined) {
				newEntry.inputCost = usage.inputCost;
			}
			if (usage.outputCost !== undefined) {
				newEntry.outputCost = usage.outputCost;
			}
			if (usage.totalCost !== undefined) {
				newEntry.totalCost = usage.totalCost;
			}
		}

		return await this.create(newEntry);
	};

	// Atomically find pending entry and create new "sending" entry
	// Returns null if no pending entry exists (already locked/processed)
	schema.statics.markAsSending = async function (processId) {
		// Find the latest pending entry for this processId
		const pendingEntry = await this.findOne({
			processId,
			status: "pending",
		})
			.sort({ createdAt: -1 })
			.exec();

		if (!pendingEntry) {
			return null;
		}

		// Create new "sending" entry (event-sourcing pattern)
		return await this.createWithStatus(pendingEntry, "sending");
	};

	schema.statics.markAsProcessing = async function (original) {
		return await this.createWithStatus(original, "processing");
	};

	schema.statics.markAsCompleted = async function (original, usage) {
		return await this.createWithStatus(original, "completed", undefined, usage);
	};

	schema.statics.markAsFailed = async function (original, error, usage) {
		return await this.createWithStatus(original, "failed", error, usage);
	};

	schema.statics.markAsNotACV = async function (original, usage) {
		return await this.createWithStatus(original, "not-a-cv", undefined, usage);
	};

	schema.statics.findPendingLogs = async function (limit) {
		// Find the latest record for each processId where status is "pending"
		// This uses aggregation to group by processId and get the most recent entry
		const results = await this.aggregate([
			// Sort by processId and createdAt descending to get latest first
			{ $sort: { processId: 1, createdAt: -1 } },
			// Group by processId and take the first (latest) document
			{
				$group: {
					_id: "$processId",
					latestDoc: { $first: "$$ROOT" },
				},
			},
			// Replace root with the latest document
			{ $replaceRoot: { newRoot: "$latestDoc" } },
			// Filter to only include entries with status "pending"
			{ $match: { status: "pending" } },
			// Sort by creation time to process oldest first
			{ $sort: { createdAt: 1 } },
			// Limit results
			{ $limit: limit },
		]);

		// Convert plain objects back to Mongoose documents
		return results.map((doc) => new this(doc));
	};

	schema.statics.getPending = async function (limit) {
		// Alias for findPendingLogs for backward compatibility
		return await this.findPendingLogs(limit);
	};

	schema.statics.findByFileId = async function (fileId) {
		return await this.findOne({ fileId }).sort({ createdAt: -1 }).exec();
	};

	schema.statics.findByProcessId = async function (processId) {
		return await this.find({ processId }).sort({ createdAt: -1 }).exec();
	};
};
