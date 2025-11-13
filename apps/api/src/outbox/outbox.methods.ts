import type { Schema } from "mongoose";

import type {
	OutboxDocument,
	OutboxMethods,
	OutboxModelWithStatics,
	TOutbox,
} from "./outbox.types.js";
import { OutboxEntryAlreadyProcessingError } from "./outbox.errors.js";

export const registerOutboxMethods = (
	schema: Schema<TOutbox, OutboxModelWithStatics, OutboxMethods>,
) => {
	schema.methods.markAsProcessing = async function (this: OutboxDocument) {
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
		this.status = "completed";
		this.processedAt = new Date();
		return await this.save();
	};

	schema.methods.markAsFailed = async function (
		this: OutboxDocument,
		error: string,
	) {
		this.status = "failed";
		this.error = error;
		this.processedAt = new Date();
		return await this.save();
	};
};
