import { beforeEach, describe, expect, it } from "vitest";
import { AutofillRefineModel } from "./autofillRefine.model.js";

describe("AutofillRefineModel", () => {
	beforeEach(async () => {
		await AutofillRefineModel.collection.drop().catch(() => {});
		await AutofillRefineModel.createIndexes();
	});

	const TEST_AUTOFILL_ID = "autofill-123";

	describe("findByAutofillId", () => {
		it("should return empty array when no refines exist", async () => {
			const results =
				await AutofillRefineModel.findByAutofillId(TEST_AUTOFILL_ID);
			expect(results).toEqual([]);
		});

		it("should return single refine for single hash", async () => {
			await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "test@example.com",
				fieldLabel: "Email",
				prevFieldText: "",
				userInstructions: "Use test email",
			});

			const results =
				await AutofillRefineModel.findByAutofillId(TEST_AUTOFILL_ID);

			expect(results).toHaveLength(1);
			expect(results[0].hash).toBe("hash-1");
			expect(results[0].value).toBe("test@example.com");
		});

		it("should return multiple refines for multiple hashes", async () => {
			await AutofillRefineModel.create([
				{
					autofillId: TEST_AUTOFILL_ID,
					hash: "hash-1",
					value: "email@example.com",
					fieldLabel: "Email",
					prevFieldText: "",
					userInstructions: "Use email",
				},
				{
					autofillId: TEST_AUTOFILL_ID,
					hash: "hash-2",
					value: "John Doe",
					fieldLabel: "Name",
					prevFieldText: "",
					userInstructions: "Use name",
				},
				{
					autofillId: TEST_AUTOFILL_ID,
					hash: "hash-3",
					value: "123-456-7890",
					fieldLabel: "Phone",
					prevFieldText: "",
					userInstructions: "Use phone",
				},
			]);

			const results =
				await AutofillRefineModel.findByAutofillId(TEST_AUTOFILL_ID);

			expect(results).toHaveLength(3);
			const hashes = results.map((r) => r.hash).sort();
			expect(hashes).toEqual(["hash-1", "hash-2", "hash-3"]);
		});

		it("should return only latest refine per hash when multiple refines exist for same hash", async () => {
			await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "first@example.com",
				fieldLabel: "Email",
				prevFieldText: "",
				userInstructions: "First instruction",
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "second@example.com",
				fieldLabel: "Email",
				prevFieldText: "first@example.com",
				userInstructions: "Second instruction",
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "third@example.com",
				fieldLabel: "Email",
				prevFieldText: "second@example.com",
				userInstructions: "Third instruction",
			});

			const results =
				await AutofillRefineModel.findByAutofillId(TEST_AUTOFILL_ID);

			expect(results).toHaveLength(1);
			expect(results[0].hash).toBe("hash-1");
			expect(results[0].value).toBe("third@example.com");
		});

		it("should return latest refine per hash when multiple hashes have multiple refines", async () => {
			await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "old-email@example.com",
				fieldLabel: "Email",
				prevFieldText: "",
				userInstructions: "Old email instruction",
			});

			await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-2",
				value: "Old Name",
				fieldLabel: "Name",
				prevFieldText: "",
				userInstructions: "Old name instruction",
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "new-email@example.com",
				fieldLabel: "Email",
				prevFieldText: "old-email@example.com",
				userInstructions: "New email instruction",
			});

			await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-2",
				value: "New Name",
				fieldLabel: "Name",
				prevFieldText: "Old Name",
				userInstructions: "New name instruction",
			});

			const results =
				await AutofillRefineModel.findByAutofillId(TEST_AUTOFILL_ID);

			expect(results).toHaveLength(2);

			const hash1Result = results.find((r) => r.hash === "hash-1");
			const hash2Result = results.find((r) => r.hash === "hash-2");

			expect(hash1Result?.value).toBe("new-email@example.com");
			expect(hash2Result?.value).toBe("New Name");
		});

		it("should only return refines for specified autofillId", async () => {
			await AutofillRefineModel.create([
				{
					autofillId: TEST_AUTOFILL_ID,
					hash: "hash-1",
					value: "correct@example.com",
					fieldLabel: "Email",
					prevFieldText: "",
					userInstructions: "Correct instruction",
				},
				{
					autofillId: "different-autofill-id",
					hash: "hash-1",
					value: "wrong@example.com",
					fieldLabel: "Email",
					prevFieldText: "",
					userInstructions: "Wrong instruction",
				},
			]);

			const results =
				await AutofillRefineModel.findByAutofillId(TEST_AUTOFILL_ID);

			expect(results).toHaveLength(1);
			expect(results[0].value).toBe("correct@example.com");
		});

		it("should handle null values", async () => {
			await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: null,
				fieldLabel: "Optional Field",
				prevFieldText: "",
				userInstructions: "Leave empty",
			});

			const results =
				await AutofillRefineModel.findByAutofillId(TEST_AUTOFILL_ID);

			expect(results).toHaveLength(1);
			expect(results[0].value).toBeNull();
		});

		it("should preserve createdAt and updatedAt from latest refine", async () => {
			await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "first@example.com",
				fieldLabel: "Email",
				prevFieldText: "",
				userInstructions: "First instruction",
			});

			await new Promise((resolve) => setTimeout(resolve, 10));

			const secondRefine = await AutofillRefineModel.create({
				autofillId: TEST_AUTOFILL_ID,
				hash: "hash-1",
				value: "second@example.com",
				fieldLabel: "Email",
				prevFieldText: "first@example.com",
				userInstructions: "Second instruction",
			});

			const results =
				await AutofillRefineModel.findByAutofillId(TEST_AUTOFILL_ID);

			expect(results).toHaveLength(1);
			expect(results[0].createdAt.getTime()).toBe(
				secondRefine.createdAt.getTime(),
			);
			expect(results[0].updatedAt.getTime()).toBe(
				secondRefine.updatedAt.getTime(),
			);
		});
	});
});
