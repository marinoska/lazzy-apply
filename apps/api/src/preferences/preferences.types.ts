import type { Document, Model, Types } from "mongoose";

export const PREFERENCES_MODEL_NAME = "preferences" as const;

export type TPreferences = {
	userId: string;
	selectedUploadId: Types.ObjectId | null;
	createdAt: Date;
	updatedAt: Date;
};

export type PreferencesMethods = Record<string, never>;

export type PreferencesStatics = {
	findByUserId(
		this: PreferencesModelWithStatics,
		userId: string,
	): Promise<PreferencesDocument | null>;
	upsertSelectedUpload(
		this: PreferencesModelWithStatics,
		userId: string,
		selectedUploadId: Types.ObjectId | null,
	): Promise<PreferencesDocument>;
	clearSelectedUploadIfMatches(
		this: PreferencesModelWithStatics,
		userId: string,
		uploadId: Types.ObjectId,
	): Promise<unknown>;
};

export type PreferencesDocument = Document & TPreferences & PreferencesMethods;

export type PreferencesModelBase = Model<
	TPreferences,
	Record<string, never>,
	PreferencesMethods
>;

export type PreferencesModelWithStatics = PreferencesModelBase &
	PreferencesStatics;
