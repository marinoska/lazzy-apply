import type { Document, Model, Types } from "mongoose";

export const USAGE_MODEL_NAME = "usage" as const;

/**
 * Usage type enum - identifies what operation generated the usage
 */
export const USAGE_TYPES = [
	"form_fields_classification",
	"form_fields_inference",
	"jd_form_match",
	"autofill_refine",
	"cover_letter",
] as const;
export type UsageType = (typeof USAGE_TYPES)[number];

/**
 * Reference table enum - identifies which table the reference refers to
 */
export const USAGE_REFERENCE_TABLES = [
	"forms",
	"autofill_refines",
	"autofill",
] as const;
export type UsageReferenceTable = (typeof USAGE_REFERENCE_TABLES)[number];

/**
 * Stored usage document structure
 * All fields are immutable - usage records are append-only
 */
export type TUsage = {
	/** Table name the reference refers to */
	referenceTable: UsageReferenceTable;
	/** Reference to the entity that generated this usage (dynamic relationship via refPath) */
	reference: Types.ObjectId;
	/** User who triggered this usage */
	userId: string;
	/** Shared ID for all LLM calls within a single autofill request */
	autofillId: string;
	/** Type of usage - determines what operation generated the usage */
	type: UsageType;
	/** Token usage from AI processing */
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	/** Estimated cost breakdown in USD */
	inputCost?: number;
	outputCost?: number;
	totalCost?: number;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateUsageParams = Omit<TUsage, "createdAt" | "updatedAt">;

export type UsageMethods = Record<string, never>;

export type UsageStatics = {
	createUsage(
		this: UsageModelWithStatics,
		params: CreateUsageParams,
	): Promise<UsageDocument>;
	findByReference(
		this: UsageModelWithStatics,
		reference: Types.ObjectId,
		type: UsageType,
	): Promise<UsageDocument | null>;
	findByType(this: UsageModelWithStatics, type: UsageType): Promise<TUsage[]>;
};

export type UsageDocument = Document & TUsage & UsageMethods;

export type UsageModelBase = Model<TUsage, Record<string, never>, UsageMethods>;

export type UsageModelWithStatics = UsageModelBase & UsageStatics;
