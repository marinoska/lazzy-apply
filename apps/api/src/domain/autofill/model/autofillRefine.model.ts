import { model, Schema } from "mongoose";
import {
	AUTOFILL_REFINE_MODEL_NAME,
	type AutofillRefineMethods,
	type AutofillRefineModelWithStatics,
	type TAutofillRefine,
} from "./autofillRefine.types.js";

export type AutofillRefineModel = AutofillRefineModelWithStatics;

const autofillRefineSchema = new Schema<
	TAutofillRefine,
	AutofillRefineModel,
	AutofillRefineMethods
>(
	{
		autofillId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		hash: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
		value: {
			type: String,
			default: null,
		},
	},
	{ timestamps: true, collection: AUTOFILL_REFINE_MODEL_NAME },
);

autofillRefineSchema.index({ autofillId: 1, createdAt: -1 });

/**
 * Finds all refines for a given autofillId, returning only the latest refine per hash.
 * Uses MongoDB aggregation to group by (autofillId, hash) pair and returns the most recent value.
 */
autofillRefineSchema.statics.findByAutofillId = async function (
	this: AutofillRefineModelWithStatics,
	autofillId: string,
) {
	const results = await this.aggregate([
		{ $match: { autofillId } },
		{ $sort: { createdAt: -1 } },
		{
			$group: {
				_id: { autofillId: "$autofillId", hash: "$hash" },
				autofillId: { $first: "$autofillId" },
				hash: { $first: "$hash" },
				value: { $first: "$value" },
				createdAt: { $first: "$createdAt" },
				updatedAt: { $first: "$updatedAt" },
			},
		},
	]);

	return results.map((r) => ({
		autofillId: r.autofillId,
		hash: r.hash,
		value: r.value,
		createdAt: r.createdAt,
		updatedAt: r.updatedAt,
	}));
};

export type { AutofillRefineDocument } from "./autofillRefine.types.js";

export const AutofillRefineModel = model<TAutofillRefine, AutofillRefineModel>(
	AUTOFILL_REFINE_MODEL_NAME,
	autofillRefineSchema,
);
