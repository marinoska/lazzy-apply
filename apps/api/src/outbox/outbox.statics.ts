import type { Schema } from "mongoose";

import type {
	CreateOutboxParams,
	OutboxDocument,
	OutboxModelBase,
	TOutbox,
} from "./outbox.types.js";
import type { OutboxMethods } from "./outbox.methods.js";

export type OutboxStatics = {
	createOutbox(
		this: OutboxModelWithStatics,
		payload: CreateOutboxParams,
	): Promise<OutboxDocument>;
	findPendingLogs(
		this: OutboxModelWithStatics,
		limit: number,
	): Promise<OutboxDocument[]>;
	findByFileId(
		this: OutboxModelWithStatics,
		fileId: string,
	): Promise<OutboxDocument | null>;
};

export type OutboxModelWithStatics = OutboxModelBase & OutboxStatics;

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
