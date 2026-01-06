import { model, Schema } from "mongoose";
import { applyOwnershipEnforcement } from "@/app/middleware/mongoOwnershipEnforcement.middleware.js";
import {
	AUTOFILL_MODEL_NAME,
	type AutofillMethods,
	type AutofillModelWithStatics,
	type TAutofill,
} from "./autofill.types.js";
import { AutofillRefineModel } from "./autofillRefine.model.js";
import { FORM_FIELD_MODEL_NAME, FORM_MODEL_NAME } from "./formField.types.js";

export type AutofillModel = AutofillModelWithStatics;

const autofillSchema = new Schema<TAutofill, AutofillModel, AutofillMethods>(
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
			unique: true,
		},
		formReference: {
			type: Schema.Types.ObjectId,
			ref: FORM_MODEL_NAME,
			required: true,
			index: true,
			immutable: true,
		},
		uploadReference: {
			type: Schema.Types.ObjectId,
			ref: "file_uploads",
			required: true,
			index: true,
			immutable: true,
		},
		cvDataReference: {
			type: Schema.Types.ObjectId,
			ref: "cv_data",
			required: true,
			index: true,
			immutable: true,
		},
		jdRawText: {
			type: String,
			default: "",
			immutable: true,
		},
		jdUrl: {
			type: String,
			default: "",
			immutable: true,
		},
		formUrl: {
			type: String,
			default: "",
			immutable: true,
		},
		jdMatchesForm: {
			type: Boolean,
			required: true,
			immutable: true,
		},
		jdFacts: {
			type: [
				{
					key: { type: String, required: true, immutable: true },
					value: { type: String, required: true, immutable: true },
					source: {
						type: String,
						required: true,
						enum: ["jd", "form"],
						immutable: true,
					},
				},
			],
			default: [],
			immutable: true,
		},
		formContext: {
			type: String,
			default: "",
			immutable: true,
		},
		data: {
			type: [
				{
					hash: { type: String, required: true, index: true, immutable: true },
					fieldRef: {
						type: Schema.Types.ObjectId,
						ref: FORM_FIELD_MODEL_NAME,
						required: true,
						immutable: true,
					},
					fieldName: { type: String, required: true, immutable: true },
					label: { type: String, immutable: true },
					// Classification fields - stored to match AutofillResponseItem
					path: { type: String, required: true, immutable: true },
					pathFound: { type: Boolean, required: true, immutable: true },
					linkType: { type: String, immutable: true },
					inferenceHint: { type: String, immutable: true },
					// Text field value (mutually exclusive with file fields)
					value: { type: String, immutable: true },
					// File upload fields (mutually exclusive with value)
					fileUrl: { type: String, immutable: true },
					fileName: { type: String, immutable: true },
					fileContentType: { type: String, immutable: true },
				},
			],
			required: true,
			immutable: true,
			validate: {
				validator: (
					data: Array<{
						value?: string | null;
						fileUrl?: string;
						fileName?: string;
						fileContentType?: string;
					}>,
				) =>
					data.every((item) => {
						const hasAnyFileField =
							item.fileUrl !== undefined ||
							item.fileName !== undefined ||
							item.fileContentType !== undefined;
						const hasAllFileFields =
							item.fileUrl !== undefined &&
							item.fileName !== undefined &&
							item.fileContentType !== undefined;
						// If any file field is present, all must be present
						// Text items have no file fields
						return !hasAnyFileField || hasAllFileFields;
					}),
				message:
					"File upload items must have all file fields (fileUrl, fileName, fileContentType)",
			},
		},
	},
	{ timestamps: true, collection: AUTOFILL_MODEL_NAME },
);

// Compound index for efficient lookups by user, upload, form, and autofillId
// Supports queries by userId/uploadReference/formReference or all 4 fields
autofillSchema.index(
	{
		userId: 1,
		uploadReference: 1,
		formReference: 1,
		autofillId: 1,
	},
	{ unique: true },
);

// Helper method to apply refines to autofill data
const applyRefinesToAutofill = async (
	baseAutofill: TAutofill,
): Promise<TAutofill> => {
	const refines = await AutofillRefineModel.findByAutofillId(
		baseAutofill.autofillId,
		baseAutofill.userId,
	);

	if (refines.length === 0) {
		return baseAutofill;
	}

	const refineMap = new Map(refines.map((r) => [r.hash, r.value]));

	const updatedData = baseAutofill.data.map((item) => {
		const refinedValue = refineMap.get(item.hash);
		if (
			refinedValue !== undefined &&
			"value" in item &&
			item.value !== undefined
		) {
			return {
				hash: item.hash,
				fieldRef: item.fieldRef,
				fieldName: item.fieldName,
				label: item.label,
				path: item.path,
				pathFound: item.pathFound,
				value: refinedValue,
				...(item.linkType && { linkType: item.linkType }),
				...(item.inferenceHint && { inferenceHint: item.inferenceHint }),
			};
		}
		return item;
	});

	return {
		...baseAutofill,
		data: updatedData,
	};
};

// Static methods
autofillSchema.statics.findByAutofillId = async function (
	this: AutofillModelWithStatics,
	autofillId: string,
	userId?: string,
) {
	const query = this.findOne({ autofillId });
	if (userId) {
		query.setOptions({ userId });
	}
	const baseAutofill = await query.lean();
	if (!baseAutofill) {
		return null;
	}

	return applyRefinesToAutofill(baseAutofill);
};

autofillSchema.statics.findMostRecentByUserUploadForm = async function (
	this: AutofillModelWithStatics,
	userId: string,
	uploadId: string,
	formId: string,
) {
	const baseAutofill = await this.findOne({
		userId,
		uploadReference: uploadId,
		formReference: formId,
	})
		.setOptions({ userId })
		.sort({ createdAt: -1 })
		.lean()
		.exec();

	if (!baseAutofill) {
		return null;
	}

	return applyRefinesToAutofill(baseAutofill);
};

applyOwnershipEnforcement(autofillSchema);

export type { AutofillDocument } from "./autofill.types.js";

export const AutofillModel = model<TAutofill, AutofillModel>(
	AUTOFILL_MODEL_NAME,
	autofillSchema,
);
