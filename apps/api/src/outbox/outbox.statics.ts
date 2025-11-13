import type { Schema } from "mongoose";

import type {
	CreateOutboxParams,
	OutboxDocument,
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

	schema.statics.findPendingLogs = async function (limit) {
		return await this.find({
			status: "pending",
		})
			.sort({ createdAt: 1 })
			.limit(limit)
			.exec();
	};

	schema.statics.findByFileId = async function (fileId) {
		return await this.findOne({ fileId }).exec();
	};
};
