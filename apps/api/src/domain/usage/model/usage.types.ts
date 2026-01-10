import type { Document, Model, Types } from "mongoose";
import { FILE_UPLOAD_MODEL_NAME } from "@/domain/uploads/model/fileUpload.types.js";

export const USAGE_MODEL_NAME = "usage" as const;

/**
 * Usage type enum - identifies what operation generated the usage
 */
export const USAGE_TYPES = [
	"form_fields_classification",
	"form_fields_inference",
	"jd_form_extractor:router",
	"jd_form_extractor:writer",
	"autofill_refine",
	"cover_letter",
	"cv_data_extraction",
] as const;
export type UsageType = (typeof USAGE_TYPES)[number];

/**
 * Credits type enum - identifies what operation generated the credit grant
 */
export const CREDITS_TYPES = [
	"signup_bonus",
	"referral_bonus",
	"admin_grant",
	"promotion",
] as const;
export type CreditsType = (typeof CREDITS_TYPES)[number];

/**
 * Reference table enum - identifies which table the reference refers to
 */
export const USAGE_REFERENCE_TABLES = [
	"forms",
	"autofill_refines",
	"autofill",
	"autofill_cover_letters",
	"cv_data",
	FILE_UPLOAD_MODEL_NAME,
] as const;
export type UsageReferenceTable = (typeof USAGE_REFERENCE_TABLES)[number];

/**
 * Base fields shared by all usage records
 */
type BaseUsage = {
	/** Table name the reference refers to */
	referenceTable: UsageReferenceTable;
	/** Reference to the entity that generated this usage (dynamic relationship via refPath) */
	reference: Types.ObjectId;
	/** User who triggered this usage */
	userId: string;
	/** Balance change in credits (negative = spend, positive = grant) */
	creditsDelta: number;
	createdAt: Date;
	updatedAt: Date;
};

/**
 * Credits grant record - for credit grants without token consumption
 */
export type TCreditsGrant = BaseUsage & {
	/** Type of credit grant */
	type: CreditsType;
	promptTokens: 0;
	completionTokens: 0;
	inputCost: 0;
	outputCost: 0;
	totalCost: 0;
};

/**
 * Token usage record - for AI processing with token consumption
 */
export type TTokenUsage = BaseUsage & {
	/** Type of token usage */
	type: UsageType;
	/** Optional autofill ID for autofill-related usage */
	autofillId?: Types.ObjectId;
	/** AI model used for processing */
	model: string;
	/** Token usage from AI processing */
	promptTokens: number;
	completionTokens: number;
	/** Estimated cost breakdown in EUR */
	inputCost: number;
	outputCost: number;
	totalCost: number;
};

/**
 * Discriminated union of all usage types
 */
export type TUsage = TCreditsGrant | TTokenUsage;

export type CreateUsageParams = Omit<TUsage, "createdAt" | "updatedAt">;

export type UsageMethods = Record<string, never>;

export type UsageStatics = {
	/**
	 * @deprecated Use UsageTracker instead to ensure user balance is updated.
	 * Direct usage creation does not update user balances.
	 * This method should only be used internally by UsageTracker.
	 */
	createUsage(
		this: UsageModelWithStatics,
		params: CreateUsageParams,
	): Promise<UsageDocument>;
	findByReference(
		this: UsageModelWithStatics,
		reference: Types.ObjectId,
		type: UsageType,
		userId?: string,
	): Promise<UsageDocument | null>;
	findByType(this: UsageModelWithStatics, type: UsageType): Promise<TUsage[]>;
};

export type UsageDocument = Document & TUsage & UsageMethods;

export type UsageModelBase = Model<TUsage, Record<string, never>, UsageMethods>;

export type UsageModelWithStatics = UsageModelBase & UsageStatics;
