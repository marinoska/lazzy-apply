import { describe, it, expect, beforeEach } from "vitest";
import { FormModel, FormFieldModel, UsageModel } from "@/formFields/index.js";
import type { Field, FormInput } from "@lazyapply/types";
import {
	persistNewFormAndFields,
	updateFormUrlsIfNeeded,
	type ClassifiedField,
} from "./persistence.service.js";

describe("persistence.service", () => {
	beforeEach(async () => {
		await FormModel.deleteMany({});
		await FormFieldModel.deleteMany({});
		await UsageModel.deleteMany({});
	});

	const createTestField = (hash: string, id: string, name: string): Field => ({
		fieldHash: hash,
		field: {
			id,
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
		fields: [
			{ hash: "hash-1", path: "test.email" },
		],
		pageUrl: "https://example.com/apply",
		action: "https://example.com/submit",
	});

	describe("persistNewFormAndFields", () => {
		it("should persist form and fields", async () => {
			const formInput = createTestFormInput();
			const field = createTestField("hash-1", "field-1", "email");
			const fieldsMap = new Map([[field.fieldHash, field]]);

			const classifiedFields: ClassifiedField[] = [
				{
					hash: "hash-1",
					classification: { hash: "hash-1", classification: "personal.email" },
					paths: ["test.email"],
				},
			];

			const tokenUsage = {
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
			};

			await persistNewFormAndFields(formInput, classifiedFields, classifiedFields, fieldsMap, tokenUsage);

			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();
			expect(savedForm?.pageUrls).toContain("https://example.com/apply");
			expect(savedForm?.actions).toContain("https://example.com/submit");
			expect(savedForm?.fields).toHaveLength(1);
			expect(savedForm?.fields[0].hash).toBe("hash-1");
			expect(savedForm?.fields[0].path).toBe("test.email");

			const savedField = await FormFieldModel.findOne({ fieldHash: "hash-1" });
			expect(savedField).not.toBeNull();
			expect(savedField?.classification).toBe("personal.email");
			expect(savedField?.path).toBe("test.email");
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

			// Check usage was saved to Usage model with form's _id as reference
			const savedUsage = await UsageModel.findOne({ reference: savedForm?._id });
			expect(savedUsage).not.toBeNull();
			expect(savedUsage?.type).toBe("form_fields_classification");
			expect(savedUsage?.totalTokens).toBe(150);
		});

		it("should handle form with no action", async () => {
			const formInput: FormInput = {
				...createTestFormInput(),
				action: null,
			};
			const field = createTestField("hash-1", "field-1", "email");
			const fieldsMap = new Map([[field.fieldHash, field]]);

			const classifiedFields: ClassifiedField[] = [
				{
					hash: "hash-1",
					classification: { hash: "hash-1", classification: "personal.email" },
					paths: ["test.email"],
				},
			];

			await persistNewFormAndFields(formInput, classifiedFields, classifiedFields, fieldsMap, {
				promptTokens: 0,
				completionTokens: 0,
				totalTokens: 0,
			});

			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm?.actions).toEqual([]);

			// Usage should be saved with 0 values
			const savedUsage = await UsageModel.findOne({ reference: savedForm?._id });
			expect(savedUsage).not.toBeNull();
			expect(savedUsage?.totalTokens).toBe(0);
			expect(savedUsage?.inputCost).toBe(0);
			expect(savedUsage?.outputCost).toBe(0);
			expect(savedUsage?.totalCost).toBe(0);
		});
	});

	describe("updateFormUrlsIfNeeded", () => {
		it("should add new pageUrl when not present", async () => {
			await FormModel.create({
				formHash: "test-form-hash",
				fields: [{ hash: "hash-1", path: null }],
				pageUrls: ["https://example.com/page1"],
				actions: [],
			});

			const existingForm = await FormModel.findOne({ formHash: "test-form-hash" });
			await updateFormUrlsIfNeeded(existingForm!, "https://example.com/page2", null);

			const updatedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(updatedForm?.pageUrls).toContain("https://example.com/page1");
			expect(updatedForm?.pageUrls).toContain("https://example.com/page2");
		});

		it("should add new action when not present", async () => {
			await FormModel.create({
				formHash: "test-form-hash",
				fields: [{ hash: "hash-1", path: null }],
				pageUrls: ["https://example.com/page1"],
				actions: ["https://example.com/action1"],
			});

			const existingForm = await FormModel.findOne({ formHash: "test-form-hash" });
			await updateFormUrlsIfNeeded(
				existingForm!,
				"https://example.com/page1",
				"https://example.com/action2",
			);

			const updatedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(updatedForm?.actions).toContain("https://example.com/action1");
			expect(updatedForm?.actions).toContain("https://example.com/action2");
		});

		it("should not duplicate existing pageUrl", async () => {
			await FormModel.create({
				formHash: "test-form-hash",
				fields: [{ hash: "hash-1", path: null }],
				pageUrls: ["https://example.com/page1"],
				actions: [],
			});

			const existingForm = await FormModel.findOne({ formHash: "test-form-hash" });
			await updateFormUrlsIfNeeded(existingForm!, "https://example.com/page1", null);

			const updatedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(updatedForm?.pageUrls).toHaveLength(1);
		});
	});

	describe("persistNewFormAndFields with mixed cached and new fields", () => {
		it("should only insert new fields while referencing all fields in form", async () => {
			const formInput: FormInput = {
				formHash: "test-form-mixed",
				fields: [
					{ hash: "hash-cached", path: "test.email" },
					{ hash: "hash-new", path: "test.phone" },
				],
				pageUrl: "https://example.com/apply",
				action: null,
			};

			const newField = createTestField("hash-new", "field-new", "phone");
			const fieldsMap = new Map([[newField.fieldHash, newField]]);

			const allClassifiedFields: ClassifiedField[] = [
				{
					hash: "hash-cached",
					classification: { hash: "hash-cached", classification: "personal.email" },
					paths: ["test.email"],
				},
				{
					hash: "hash-new",
					classification: { hash: "hash-new", classification: "personal.phone" },
					paths: ["test.phone"],
				},
			];

			const newlyClassifiedFields: ClassifiedField[] = [
				{
					hash: "hash-new",
					classification: { hash: "hash-new", classification: "personal.phone" },
					paths: ["test.phone"],
				},
			];

			await persistNewFormAndFields(
				formInput,
				allClassifiedFields,
				newlyClassifiedFields,
				fieldsMap,
				{ promptTokens: 0, completionTokens: 0, totalTokens: 0 },
			);

			// Form should reference both fields
			const savedForm = await FormModel.findOne({ formHash: "test-form-mixed" });
			expect(savedForm?.fields).toHaveLength(2);
			expect(savedForm?.fields.map((f) => f.hash)).toContain("hash-cached");
			expect(savedForm?.fields.map((f) => f.hash)).toContain("hash-new");

			// Only new field should be inserted
			const savedNewField = await FormFieldModel.findOne({ fieldHash: "hash-new" });
			expect(savedNewField).not.toBeNull();
			expect(savedNewField?.classification).toBe("personal.phone");

			// Cached field should NOT be inserted (fieldsMap doesn't have it)
			const cachedField = await FormFieldModel.findOne({ fieldHash: "hash-cached" });
			expect(cachedField).toBeNull();
		});
	});
});
