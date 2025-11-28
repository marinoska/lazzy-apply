import type { Schema } from "mongoose";

import type {
	OutboxDocument,
	OutboxMethods,
	OutboxModelWithStatics,
	TOutbox,
} from "./outbox.types.js";
import {
	OutboxEntryAlreadyProcessingError,
	OutboxTerminalStatusError,
} from "./outbox.errors.js";

export const registerOutboxMethods = (
	schema: Schema<TOutbox, OutboxModelWithStatics, OutboxMethods>,
) => {
	schema.methods.isTerminal = function (this: OutboxDocument) {
		return this.status === "completed" || this.status === "failed";
	};
	schema.methods.markAsProcessing = async function (this: OutboxDocument) {
		// Check if already in terminal state
		if (this.isTerminal()) {
			throw new OutboxTerminalStatusError(this.status, "processing");
		}
		
		// Use atomic update to prevent race conditions
		// Only update if status is still "pending"
		const updated = await this.model("outbox").findOneAndUpdate(
			{ _id: this._id, status: "pending" },
			{ status: "processing" },
			{ new: true },
		);
		
		if (!updated) {
			throw new OutboxEntryAlreadyProcessingError(this.logId);
		}
		
		// Update local document to reflect the change
		this.status = "processing";
		return this;
	};

	schema.methods.markAsCompleted = async function (this: OutboxDocument) {
		// If already completed, this is idempotent - just return
		if (this.status === "completed") {
			return this;
		}
		
		// Allow transitioning from "failed" to "completed" for retry scenarios
		// This happens when a message fails initially but succeeds on retry
		if (this.status === "failed") {
			this.status = "completed";
			this.error = undefined; // Clear the error since it succeeded
			this.processedAt = new Date();
			return await this.save();
		}
		
		// Only prevent transition if status is something unexpected
		if (this.status !== "processing" && this.status !== "pending") {
			throw new OutboxTerminalStatusError(this.status, "completed");
		}
		
		this.status = "completed";
		this.processedAt = new Date();
		return await this.save();
	};

	schema.methods.markAsFailed = async function (
		this: OutboxDocument,
		error: string,
	) {
		// Check if already in terminal state
		if (this.isTerminal()) {
			throw new OutboxTerminalStatusError(this.status, "failed");
		}
		
		this.status = "failed";
		this.error = error;
		this.processedAt = new Date();
		return await this.save();
	};
};
