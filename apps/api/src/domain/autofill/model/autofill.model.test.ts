import type { FormFieldPath } from "@lazyapply/types";
import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { FormFieldModel, FormModel } from "../index.js";
import { AutofillModel } from "./autofill.model.js";
import { AutofillRefineModel } from "./autofillRefine.model.js";

describe("AutofillModel", () => {
	beforeEach(async () => {
		await AutofillModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		await AutofillRefineModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		await FormModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		await FormFieldModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		await AutofillModel.syncIndexes();
	});

	const TEST_USER_ID = "test-user-123";
	const TEST_AUTOFILL_ID = "autofill-abc";
	const TEST_UPLOAD_ID = new mongoose.Types.ObjectId();
	const TEST_FORM_ID = new mongoose.Types.ObjectId();
	const TEST_CV_DATA_ID = new mongoose.Types.ObjectId();

	const createTestAutofillData = (overrides = {}) => ({
		userId: TEST_USER_ID,
		autofillId: TEST_AUTOFILL_ID,
		uploadReference: TEST_UPLOAD_ID,
		formReference: TEST_FORM_ID,
		cvDataReference: TEST_CV_DATA_ID,
		jdMatchesForm: false,
		jdFacts: [],
		formContext: "",
		data: [
			{
				hash: "hash-1",
				fieldRef: new mongoose.Types.ObjectId(),
				fieldName: "email",
				label: "Email",
				path: "personal.email" as FormFieldPath,
				pathFound: true,
				value: "test@example.com",
			},
		],
		...overrides,
	});

	const createTestRefineData = (overrides = {}) => ({
		userId: TEST_USER_ID,
		autofillId: TEST_AUTOFILL_ID,
		hash: "hash-1",
		value: "refined@example.com",
		fieldLabel: "Email",
		prevFieldText: "test@example.com",
		userInstructions: "Update email",
		...overrides,
	});

	describe("autofillId constraint validator", () => {
		it("should reject duplicate autofillId", async () => {
			const data1 = createTestAutofillData();
			const data2 = createTestAutofillData({
				data: [
					{
						hash: "hash-2",
						fieldRef: new mongoose.Types.ObjectId(),
						fieldName: "phone",
						label: "Phone",
						path: "personal.phone" as FormFieldPath,
						pathFound: true,
						value: "123-456-7890",
					},
				],
			});

			await AutofillModel.create(data1);
			await expect(AutofillModel.create(data2)).rejects.toThrow(
				/duplicate key/,
			);
		});

		it("should allow different autofillId for same userId, uploadReference, formReference", async () => {
			const data1 = createTestAutofillData();
			await AutofillModel.create(data1);

			const data2 = createTestAutofillData({
				autofillId: "different-autofill-id",
			});

			await expect(AutofillModel.create(data2)).resolves.toBeDefined();
		});

		it("should allow different autofillId for different userId", async () => {
			const data1 = createTestAutofillData();
			await AutofillModel.create(data1);

			const data2 = createTestAutofillData({
				userId: "different-user-456",
				autofillId: "different-autofill-id",
			});

			await expect(AutofillModel.create(data2)).resolves.toBeDefined();
		});

		it("should allow different autofillId for different uploadReference", async () => {
			const data1 = createTestAutofillData();
			await AutofillModel.create(data1);

			const data2 = createTestAutofillData({
				uploadReference: new mongoose.Types.ObjectId(),
				autofillId: "different-autofill-id",
			});

			await expect(AutofillModel.create(data2)).resolves.toBeDefined();
		});

		it("should allow different autofillId for different formReference", async () => {
			const data1 = createTestAutofillData();
			await AutofillModel.create(data1);

			const data2 = createTestAutofillData({
				formReference: new mongoose.Types.ObjectId(),
				autofillId: "different-autofill-id",
			});

			await expect(AutofillModel.create(data2)).resolves.toBeDefined();
		});

		it("should enforce unique autofillId globally even across different users", async () => {
			const data1 = createTestAutofillData();
			await AutofillModel.create(data1);

			const data2 = createTestAutofillData({
				userId: "different-user-456",
			});

			await expect(AutofillModel.create(data2)).rejects.toThrow(
				/duplicate key/,
			);
		});
	});

	describe("static methods", () => {
		it("findByAutofillId should return record by autofillId", async () => {
			const data = createTestAutofillData();
			await AutofillModel.create(data);

			const result = await AutofillModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);
			expect(result).not.toBeNull();
			expect(result?.autofillId).toBe(TEST_AUTOFILL_ID);
		});

		it("findMostRecentByUserUploadForm should return most recent record", async () => {
			const data1 = createTestAutofillData();
			await AutofillModel.create(data1);

			await new Promise((resolve) => setTimeout(resolve, 10));

			const data2 = createTestAutofillData({
				autofillId: "autofill-def",
				data: [
					{
						hash: "hash-2",
						fieldRef: new mongoose.Types.ObjectId(),
						fieldName: "name",
						label: "Name",
						path: "personal.fullName" as FormFieldPath,
						pathFound: true,
						value: "John Doe",
					},
				],
			});
			await AutofillModel.create(data2);

			const result = await AutofillModel.findMostRecentByUserUploadForm(
				TEST_USER_ID,
				TEST_UPLOAD_ID.toString(),
				TEST_FORM_ID.toString(),
			);

			expect(result).not.toBeNull();
			expect(result?.data[0].fieldName).toBe("name");
		});
	});

	describe("AutofillRefine integration", () => {
		it("findByAutofillId should apply refines incrementally to base autofill", async () => {
			const data = createTestAutofillData({
				data: [
					{
						hash: "hash-1",
						fieldRef: new mongoose.Types.ObjectId(),
						fieldName: "email",
						label: "Email",
						path: "personal.email" as FormFieldPath,
						pathFound: true,
						value: "original@example.com",
					},
					{
						hash: "hash-2",
						fieldRef: new mongoose.Types.ObjectId(),
						fieldName: "phone",
						label: "Phone",
						path: "personal.phone" as FormFieldPath,
						pathFound: true,
						value: "111-111-1111",
					},
				],
			});
			await AutofillModel.create(data);

			await AutofillRefineModel.create(createTestRefineData());

			const result = await AutofillModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			expect(result?.data).toHaveLength(2);

			const emailField = result?.data.find((item) => item.hash === "hash-1");
			const phoneField = result?.data.find((item) => item.hash === "hash-2");

			expect(emailField?.value).toBe("refined@example.com");
			expect(phoneField?.value).toBe("111-111-1111");
		});

		it("findByAutofillId should apply multiple refines in chronological order", async () => {
			const data = createTestAutofillData({
				data: [
					{
						hash: "hash-1",
						fieldRef: new mongoose.Types.ObjectId(),
						fieldName: "email",
						label: "Email",
						path: "personal.email" as FormFieldPath,
						pathFound: true,
						value: "original@example.com",
					},
				],
			});
			await AutofillModel.create(data);

			await AutofillRefineModel.create(
				createTestRefineData({ value: "first@example.com" }),
			);

			await new Promise((resolve) => setTimeout(resolve, 10));

			await AutofillRefineModel.create(
				createTestRefineData({ value: "second@example.com" }),
			);

			const result = await AutofillModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			const emailField = result?.data.find((item) => item.hash === "hash-1");
			expect(emailField?.value).toBe("second@example.com");
		});

		it("findByAutofillId should return base autofill when no refines exist", async () => {
			const data = createTestAutofillData();
			await AutofillModel.create(data);

			const result = await AutofillModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			expect(result?.data[0].value).toBe("test@example.com");
		});

		it("findByAutofillId should not apply refines to file upload fields", async () => {
			const data = createTestAutofillData({
				data: [
					{
						hash: "hash-resume",
						fieldRef: new mongoose.Types.ObjectId(),
						fieldName: "resume",
						label: "Resume",
						path: "resume_upload" as FormFieldPath,
						pathFound: true,
						fileUrl: "https://example.com/resume.pdf",
						fileName: "resume.pdf",
						fileContentType: "PDF",
					},
				],
			});
			await AutofillModel.create(data);

			await AutofillRefineModel.create(
				createTestRefineData({
					hash: "hash-resume",
					value: "should-not-apply",
					fieldLabel: "Resume",
				}),
			);

			const result = await AutofillModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			const resumeField = result?.data.find(
				(item) => item.hash === "hash-resume",
			);
			expect(resumeField?.fileUrl).toBe("https://example.com/resume.pdf");
			expect(resumeField?.value).toBeUndefined();
		});

		it("findByAutofillId should handle null values in refines", async () => {
			const data = createTestAutofillData();
			await AutofillModel.create(data);

			await AutofillRefineModel.create(createTestRefineData({ value: null }));

			const result = await AutofillModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(result).not.toBeNull();
			expect(result?.data[0].value).toBeNull();
		});

		it("findMostRecentByUserUploadForm should apply refines to the result", async () => {
			const data = createTestAutofillData({
				data: [
					{
						hash: "hash-1",
						fieldRef: new mongoose.Types.ObjectId(),
						fieldName: "email",
						label: "Email",
						path: "personal.email" as FormFieldPath,
						pathFound: true,
						value: "original@example.com",
					},
				],
			});
			await AutofillModel.create(data);

			await AutofillRefineModel.create(
				createTestRefineData({ value: "refined@example.com" }),
			);

			const result = await AutofillModel.findMostRecentByUserUploadForm(
				TEST_USER_ID,
				TEST_UPLOAD_ID.toString(),
				TEST_FORM_ID.toString(),
			);

			expect(result).not.toBeNull();
			expect(result?.data[0].value).toBe("refined@example.com");
		});
	});

	describe("AutofillRefineModel.findByAutofillId", () => {
		it("should return empty array when no refines exist", async () => {
			const results = await AutofillRefineModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);
			expect(results).toEqual([]);
		});

		it("should return multiple refines for multiple hashes", async () => {
			await AutofillRefineModel.create([
				createTestRefineData({
					hash: "hash-1",
					value: "email@example.com",
				}),
				createTestRefineData({
					hash: "hash-2",
					value: "John Doe",
					fieldLabel: "Name",
				}),
				createTestRefineData({
					hash: "hash-3",
					value: "123-456-7890",
					fieldLabel: "Phone",
				}),
			]);

			const results = await AutofillRefineModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(results).toHaveLength(3);
			const hashes = results.map((r) => r.hash).sort();
			expect(hashes).toEqual(["hash-1", "hash-2", "hash-3"]);
		});

		it("should return only latest refine per hash when multiple refines exist", async () => {
			await AutofillRefineModel.create(
				createTestRefineData({ value: "first@example.com" }),
			);

			await new Promise((resolve) => setTimeout(resolve, 10));

			await AutofillRefineModel.create(
				createTestRefineData({ value: "second@example.com" }),
			);

			await new Promise((resolve) => setTimeout(resolve, 10));

			await AutofillRefineModel.create(
				createTestRefineData({ value: "third@example.com" }),
			);

			const results = await AutofillRefineModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(results).toHaveLength(1);
			expect(results[0].hash).toBe("hash-1");
			expect(results[0].value).toBe("third@example.com");
		});

		it("should return latest refine per hash for multiple hashes with multiple refines each", async () => {
			await AutofillRefineModel.create(
				createTestRefineData({ value: "old-email@example.com" }),
			);

			await AutofillRefineModel.create(
				createTestRefineData({
					hash: "hash-2",
					value: "Old Name",
					fieldLabel: "Name",
				}),
			);

			await new Promise((resolve) => setTimeout(resolve, 10));

			await AutofillRefineModel.create(
				createTestRefineData({ value: "new-email@example.com" }),
			);

			await AutofillRefineModel.create(
				createTestRefineData({
					hash: "hash-2",
					value: "New Name",
					fieldLabel: "Name",
				}),
			);

			const results = await AutofillRefineModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(results).toHaveLength(2);

			const hash1Result = results.find((r) => r.hash === "hash-1");
			const hash2Result = results.find((r) => r.hash === "hash-2");

			expect(hash1Result?.value).toBe("new-email@example.com");
			expect(hash2Result?.value).toBe("New Name");
		});

		it("should only return refines for specified autofillId", async () => {
			await AutofillRefineModel.create([
				createTestRefineData({ value: "correct@example.com" }),
				createTestRefineData({
					autofillId: "different-autofill-id",
					value: "wrong@example.com",
				}),
			]);

			const results = await AutofillRefineModel.findByAutofillId(
				TEST_AUTOFILL_ID,
				TEST_USER_ID,
			);

			expect(results).toHaveLength(1);
			expect(results[0].value).toBe("correct@example.com");
		});
	});
});
