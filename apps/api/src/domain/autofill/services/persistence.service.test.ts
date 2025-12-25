import type { AutofillResponseData, Field, FormInput } from "@lazyapply/types";
import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import {
	AutofillModel,
	FormFieldModel,
	FormModel,
} from "@/domain/autofill/index.js";
import { UsageModel } from "@/domain/usage/index.js";
import type { EnrichedClassifiedField } from "../llm/classifier.llm.js";
import {
	persistAutofill,
	persistNewFormAndFields,
} from "./persistence.service.js";

describe("persistence.service", () => {
	beforeEach(async () => {
		await FormModel.deleteMany({});
		await FormFieldModel.deleteMany({});
		await UsageModel.deleteMany({});
		await AutofillModel.deleteMany({});
	});

	const TEST_USER_ID = "test-user-123";
	const TEST_UPLOAD_ID = new mongoose.Types.ObjectId().toString();
	const TEST_CV_DATA_ID = new mongoose.Types.ObjectId().toString();

	const createTestField = (hash: string, name: string): Field => ({
		hash: hash,
		field: {
			tag: "input",
			type: "text",
			name,
			label: name,
			placeholder: null,
			description: null,
			isFileUpload: false,
			accept: null,
		},
	});

	const createTestFormInput = (): FormInput => ({
		formHash: "test-form-hash",
		fields: [{ hash: "hash-1" }],
		pageUrl: "https://example.com/apply",
		action: "https://example.com/submit",
	});

	describe("persistNewFormAndFields", () => {
		it("should persist form and fields", async () => {
			const formInput = createTestFormInput();
			const field = createTestField("hash-1", "email");

			const classifiedFields: EnrichedClassifiedField[] = [
				{
					...field,
					classification: "personal.email",
				},
			];

			await persistNewFormAndFields(
				formInput,
				classifiedFields,
				classifiedFields,
			);

			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();
			expect(savedForm?.pageUrl).toBe("https://example.com/apply");
			expect(savedForm?.action).toBe("https://example.com/submit");
			expect(savedForm?.fields).toHaveLength(1);
			expect(savedForm?.fields[0].hash).toBe("hash-1");
			expect(savedForm?.fields[0].classification).toBe("personal.email");

			const savedField = await FormFieldModel.findOne({ hash: "hash-1" });
			expect(savedField).not.toBeNull();
			expect(savedField?.classification).toBe("personal.email");
			expect(savedField?.field).toEqual({
				tag: "input",
				type: "text",
				name: "email",
				label: "email",
				placeholder: null,
				description: null,
				isFileUpload: false,
				accept: null,
			});
		});

		it("should handle form with no action", async () => {
			const formInput: FormInput = {
				...createTestFormInput(),
				action: null,
			};
			const field = createTestField("hash-1", "email");

			const classifiedFields: EnrichedClassifiedField[] = [
				{
					...field,
					classification: "personal.email",
				},
			];

			await persistNewFormAndFields(
				formInput,
				classifiedFields,
				classifiedFields,
			);

			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm?.action).toBeNull();
		});
	});

	describe("persistNewFormAndFields with mixed cached and new fields", () => {
		it("should only insert new fields while referencing all fields in form", async () => {
			const formInput: FormInput = {
				formHash: "test-form-mixed",
				fields: [{ hash: "hash-cached" }, { hash: "hash-new" }],
				pageUrl: "https://example.com/apply",
				action: null,
			};

			const cachedField = createTestField("hash-cached", "email");
			const newField = createTestField("hash-new", "phone");

			// Pre-create the cached field in DB (simulating it was classified before)
			await FormFieldModel.create({
				hash: "hash-cached",
				field: cachedField.field,
				classification: "personal.email",
			});

			// Simulate cached field from DB (TFormField-like structure)
			const cachedFieldFromDb = {
				hash: "hash-cached",
				classification: "personal.email" as const,
				field: cachedField.field,
			};

			const newlyClassifiedField: EnrichedClassifiedField = {
				...newField,
				classification: "personal.phone",
			};

			await persistNewFormAndFields(
				formInput,
				[cachedFieldFromDb, newlyClassifiedField],
				[newlyClassifiedField],
			);

			// Form should reference both fields
			const savedForm = await FormModel.findOne({
				formHash: "test-form-mixed",
			});
			expect(savedForm?.fields).toHaveLength(2);
			expect(savedForm?.fields.map((f) => f.hash)).toContain("hash-cached");
			expect(savedForm?.fields.map((f) => f.hash)).toContain("hash-new");

			// Both fields should exist in DB now
			const savedNewField = await FormFieldModel.findOne({ hash: "hash-new" });
			expect(savedNewField).not.toBeNull();
			expect(savedNewField?.classification).toBe("personal.phone");

			// Cached field should still exist (was pre-created)
			const cachedFieldInDb = await FormFieldModel.findOne({
				hash: "hash-cached",
			});
			expect(cachedFieldInDb).not.toBeNull();
		});
	});

	describe("persistCachedAutofill", () => {
		it("should save autofill record with empty usage for cached form", async () => {
			// First create a field, then a form with fieldRef
			const savedField = await FormFieldModel.create({
				hash: "hash-1",
				field: {
					tag: "input",
					type: "text",
					name: "email",
					label: "email",
					placeholder: null,
					description: null,
					isFileUpload: false,
					accept: null,
				},
				classification: "personal.email",
			});

			const [savedForm] = await FormModel.create([
				{
					formHash: "cached-form-hash",
					fields: [
						{
							hash: "hash-1",
							classification: "personal.email",
							fieldRef: savedField._id,
						},
					],
					pageUrl: "https://example.com",
					action: null,
				},
			]);

			const autofillResponse: AutofillResponseData = {
				"hash-1": {
					fieldName: "email",
					label: "Email",
					path: "personal.email",
					pathFound: true,
					value: "cached@example.com",
				},
			};

			await persistAutofill(
				savedForm._id,
				TEST_UPLOAD_ID,
				TEST_CV_DATA_ID,
				TEST_USER_ID,
				autofillResponse,
			);

			// Check autofill record was saved
			const savedAutofill = await AutofillModel.findOne({
				userId: TEST_USER_ID,
			});
			expect(savedAutofill).not.toBeNull();
			expect(savedAutofill?.formReference.toString()).toBe(
				savedForm._id.toString(),
			);

			// Check empty usage was created
			const savedUsage = await UsageModel.findOne({
				reference: savedForm._id,
				userId: TEST_USER_ID,
			});
			expect(savedUsage).not.toBeNull();
			expect(savedUsage?.totalTokens).toBe(0);
			expect(savedUsage?.totalCost).toBe(0);
		});
	});
});
