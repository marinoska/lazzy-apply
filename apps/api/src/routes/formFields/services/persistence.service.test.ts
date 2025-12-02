import type { Field, FormInput } from "@lazyapply/types";
import { beforeEach, describe, expect, it } from "vitest";
import { FormFieldModel, FormModel, UsageModel } from "@/formFields/index.js";
import type { EnrichedClassifiedField } from "./classifier.service.js";
import { persistNewFormAndFields } from "./persistence.service.js";

describe("persistence.service", () => {
	beforeEach(async () => {
		await FormModel.deleteMany({});
		await FormFieldModel.deleteMany({});
		await UsageModel.deleteMany({});
	});

	const createTestField = (hash: string, id: string, name: string): Field => ({
		hash: hash,
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
		fields: [{ hash: "hash-1" }],
		pageUrl: "https://example.com/apply",
		action: "https://example.com/submit",
	});

	describe("persistNewFormAndFields", () => {
		it("should persist form and fields", async () => {
			const formInput = createTestFormInput();
			const field = createTestField("hash-1", "field-1", "email");

			const classifiedFields: EnrichedClassifiedField[] = [
				{
					...field,
					classification: "personal.email",
				},
			];

			const tokenUsage = {
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
				inputCost: 0.0001,
				outputCost: 0.00005,
				totalCost: 0.00015,
			};

			await persistNewFormAndFields(
				formInput,
				classifiedFields,
				classifiedFields,
				tokenUsage,
			);

			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();
			expect(savedForm?.pageUrls).toContain("https://example.com/apply");
			expect(savedForm?.actions).toContain("https://example.com/submit");
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

			// Check usage was saved to Usage model with form's _id as reference
			const savedUsage = await UsageModel.findOne({
				reference: savedForm?._id,
			});
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
				{
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0,
				},
			);

			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm?.actions).toEqual([]);

			// Usage should be saved with 0 values
			const savedUsage = await UsageModel.findOne({
				reference: savedForm?._id,
			});
			expect(savedUsage).not.toBeNull();
			expect(savedUsage?.totalTokens).toBe(0);
			expect(savedUsage?.inputCost).toBe(0);
			expect(savedUsage?.outputCost).toBe(0);
			expect(savedUsage?.totalCost).toBe(0);
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

			const cachedField = createTestField(
				"hash-cached",
				"field-cached",
				"email",
			);
			const newField = createTestField("hash-new", "field-new", "phone");

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
				{ promptTokens: 0, completionTokens: 0, totalTokens: 0 },
			);

			// Form should reference both fields
			const savedForm = await FormModel.findOne({
				formHash: "test-form-mixed",
			});
			expect(savedForm?.fields).toHaveLength(2);
			expect(savedForm?.fields.map((f) => f.hash)).toContain("hash-cached");
			expect(savedForm?.fields.map((f) => f.hash)).toContain("hash-new");

			// Only new field should be inserted
			const savedNewField = await FormFieldModel.findOne({ hash: "hash-new" });
			expect(savedNewField).not.toBeNull();
			expect(savedNewField?.classification).toBe("personal.phone");

			// Cached field should NOT be inserted
			const cachedFieldInDb = await FormFieldModel.findOne({
				hash: "hash-cached",
			});
			expect(cachedFieldInDb).toBeNull();
		});
	});
});
