import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";

import { UsageModel } from "./usage.model.js";
import type { CreateUsageParams } from "./usage.types.js";

describe("UsageModel", () => {
	const createUsageParams = (
		overrides: Partial<CreateUsageParams> = {},
	): CreateUsageParams => ({
		referenceTable: "autofill",
		reference: new mongoose.Types.ObjectId(),
		userId: "test-user-id",
		type: "form_fields_classification",
		promptTokens: 100,
		completionTokens: 50,
		totalTokens: 150,
		...overrides,
	});

	beforeEach(async () => {
		await UsageModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		await UsageModel.syncIndexes();
	});

	describe("createUsage", () => {
		it("should create a new usage record", async () => {
			const params = createUsageParams();

			const result = await UsageModel.createUsage(params);

			expect(result).toBeDefined();
			expect(result.reference.toString()).toBe(params.reference.toString());
			expect(result.type).toBe(params.type);
			expect(result.totalTokens).toBe(150);
		});

		it("should return existing record on duplicate (idempotent)", async () => {
			const params = createUsageParams();

			const first = await UsageModel.createUsage(params);
			const second = await UsageModel.createUsage(params);

			expect(first._id.toString()).toBe(second._id.toString());
			expect(
				await UsageModel.countDocuments().setOptions({
					skipOwnershipEnforcement: true,
				}),
			).toBe(1);
		});

		it("should allow same reference with different type", async () => {
			const reference = new mongoose.Types.ObjectId();

			await UsageModel.createUsage(
				createUsageParams({ reference, type: "form_fields_classification" }),
			);
			await UsageModel.createUsage(
				createUsageParams({ reference, type: "jd_form_match" }),
			);

			expect(
				await UsageModel.countDocuments().setOptions({
					skipOwnershipEnforcement: true,
				}),
			).toBe(2);
		});

		it("should allow same type with different reference", async () => {
			await UsageModel.createUsage(
				createUsageParams({ type: "form_fields_classification" }),
			);
			await UsageModel.createUsage(
				createUsageParams({ type: "form_fields_classification" }),
			);

			expect(
				await UsageModel.countDocuments().setOptions({
					skipOwnershipEnforcement: true,
				}),
			).toBe(2);
		});
	});

	describe("findByReference", () => {
		it("should find usage by reference and type", async () => {
			const params = createUsageParams();
			await UsageModel.createUsage(params);

			const result = await UsageModel.findOne({
				reference: params.reference,
				type: params.type,
			}).setOptions({ skipOwnershipEnforcement: true });

			expect(result).toBeDefined();
			expect(result?.reference.toString()).toBe(params.reference.toString());
		});

		it("should return null when not found", async () => {
			const result = await UsageModel.findOne({
				reference: new mongoose.Types.ObjectId(),
				type: "form_fields_classification",
			}).setOptions({ skipOwnershipEnforcement: true });

			expect(result).toBeNull();
		});
	});

	describe("findByType", () => {
		it("should find all usage records by type", async () => {
			await UsageModel.createUsage(
				createUsageParams({ type: "form_fields_classification" }),
			);
			await UsageModel.createUsage(
				createUsageParams({ type: "form_fields_classification" }),
			);
			await UsageModel.createUsage(
				createUsageParams({ type: "jd_form_match" }),
			);

			const results = await UsageModel.find({
				type: "form_fields_classification",
			})
				.setOptions({ skipOwnershipEnforcement: true })
				.lean();

			expect(results).toHaveLength(2);
		});
	});
});
