import { model, Schema } from "mongoose";
import { applyOwnershipEnforcement } from "@/app/middleware/mongoOwnershipEnforcement.middleware.js";
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
		userId: {
			type: String,
			required: true,
			index: true,
			immutable: true,
		},
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
		fieldLabel: {
			type: String,
			required: true,
		},
		fieldDescription: {
			type: String,
			required: false,
		},
		prevFieldText: {
			type: String,
			default: "",
		},
		userInstructions: {
			type: String,
			required: true,
		},
		routingDecision: {
			type: {
				useProfileSignals: { type: Boolean, required: true },
				useSummaryFacts: { type: Boolean, required: true },
				useExperienceFacts: { type: Boolean, required: true },
				useJdFacts: { type: Boolean, required: true },
				reason: { type: String, required: true },
			},
			required: false,
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
	userId?: string,
) {
	const matchStage: Record<string, unknown> = { autofillId };
	if (userId) {
		matchStage.userId = userId;
	}

	const results = await this.aggregate([
		{ $match: matchStage },
		{ $sort: { createdAt: -1 } },
		{
			$group: {
				_id: { autofillId: "$autofillId", hash: "$hash" },
				userId: { $first: "$userId" },
				autofillId: { $first: "$autofillId" },
				hash: { $first: "$hash" },
				value: { $first: "$value" },
				fieldLabel: { $first: "$fieldLabel" },
				fieldDescription: { $first: "$fieldDescription" },
				prevFieldText: { $first: "$prevFieldText" },
				userInstructions: { $first: "$userInstructions" },
				routingDecision: { $first: "$routingDecision" },
				createdAt: { $first: "$createdAt" },
				updatedAt: { $first: "$updatedAt" },
			},
		},
	]);

	return results.map(
		(r): TAutofillRefine => ({
			userId: r.userId,
			autofillId: r.autofillId,
			hash: r.hash,
			value: r.value ?? null,
			fieldLabel: r.fieldLabel,
			fieldDescription: r.fieldDescription,
			prevFieldText: r.prevFieldText,
			userInstructions: r.userInstructions,
			routingDecision: r.routingDecision,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
		}),
	);
};

applyOwnershipEnforcement(autofillRefineSchema);

export type { AutofillRefineDocument } from "./autofillRefine.types.js";
export { AUTOFILL_REFINE_MODEL_NAME } from "./autofillRefine.types.js";

export const AutofillRefineModel = model<TAutofillRefine, AutofillRefineModel>(
	AUTOFILL_REFINE_MODEL_NAME,
	autofillRefineSchema,
);
