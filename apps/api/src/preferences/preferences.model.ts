import { model, Schema } from "mongoose";

import { FILE_UPLOAD_MODEL_NAME } from "@/uploads/fileUpload.types.js";
import { registerPreferencesStatics } from "./preferences.statics.js";
import type {
	PreferencesMethods,
	PreferencesModelWithStatics,
	TPreferences,
} from "./preferences.types.js";
import { PREFERENCES_MODEL_NAME } from "./preferences.types.js";

export type PreferencesModel = PreferencesModelWithStatics;

const preferencesSchema = new Schema<
	TPreferences,
	PreferencesModel,
	PreferencesMethods
>(
	{
		userId: {
			type: String,
			required: true,
			unique: true,
			index: true,
			immutable: true,
		},
		selectedUploadId: {
			type: Schema.Types.ObjectId,
			ref: FILE_UPLOAD_MODEL_NAME,
			default: null,
		},
	},
	{ timestamps: true, collection: PREFERENCES_MODEL_NAME },
);

registerPreferencesStatics(preferencesSchema);

export type { PreferencesDocument } from "./preferences.types.js";

export const PreferencesModel = model<TPreferences, PreferencesModel>(
	PREFERENCES_MODEL_NAME,
	preferencesSchema,
);
