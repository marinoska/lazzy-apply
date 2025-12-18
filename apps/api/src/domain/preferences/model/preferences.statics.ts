import type { Schema, Types } from "mongoose";
import type { PreferencesModel } from "./preferences.model.js";
import type { PreferencesMethods, TPreferences } from "./preferences.types.js";

export function registerPreferencesStatics(
	schema: Schema<TPreferences, PreferencesModel, PreferencesMethods>,
): void {
	schema.statics.findByUserId = async function (userId: string) {
		return this.findOne({ userId });
	};

	schema.statics.upsertSelectedUpload = async function (
		userId: string,
		selectedUploadId: Types.ObjectId | null,
	) {
		return this.findOneAndUpdate(
			{ userId },
			{ $set: { selectedUploadId } },
			{ upsert: true, new: true },
		);
	};

	schema.statics.clearSelectedUploadIfMatches = async function (
		userId: string,
		uploadId: Types.ObjectId,
	) {
		return this.updateOne(
			{ userId, selectedUploadId: uploadId },
			{ $set: { selectedUploadId: null } },
		);
	};
}
