import type { AutofillResponse, Field, FormInput } from "@lazyapply/types";
import mongoose from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import {
	AutofillModel,
	FormFieldModel,
	FormModel,
	UsageModel,
} from "@/formFields/index.js";
import type { EnrichedClassifiedField } from "./classifier.service.js";
import {
	persistCachedAutofill,
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

			const tokenUsage = {
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
				inputCost: 0.0001,
				outputCost: 0.00005,
				totalCost: 0.00015,
			};

			const autofillResponse: AutofillResponse = {
				"hash-1": {
					fieldName: "email",
					path: "personal.email",
					pathFound: true,
					value: "test@example.com",
				},
			};

			await persistNewFormAndFields(
				formInput,
				classifiedFields,
				classifiedFields,
				TEST_USER_ID,
				TEST_UPLOAD_ID,
				autofillResponse,
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
			const field = createTestField("hash-1", "email");

			const classifiedFields: EnrichedClassifiedField[] = [
				{
					...field,
					classification: "personal.email",
				},
			];

			const autofillResponse: AutofillResponse = {
				"hash-1": {
					fieldName: "email",
					path: "personal.email",
					pathFound: true,
				},
			};

			await persistNewFormAndFields(
				formInput,
				classifiedFields,
				classifiedFields,
				TEST_USER_ID,
				TEST_UPLOAD_ID,
				autofillResponse,
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

			const cachedField = createTestField("hash-cached", "email");
			const newField = createTestField("hash-new", "phone");

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

			const autofillResponse: AutofillResponse = {
				"hash-cached": {
					fieldName: "email",
					path: "personal.email",
					pathFound: true,
				},
				"hash-new": {
					fieldName: "phone",
					path: "personal.phone",
					pathFound: true,
				},
			};

			await persistNewFormAndFields(
				formInput,
				[cachedFieldFromDb, newlyClassifiedField],
				[newlyClassifiedField],
				TEST_USER_ID,
				TEST_UPLOAD_ID,
				autofillResponse,
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

	describe("persistNewFormAndFields autofill record", () => {
		it("should save autofill record with field data", async () => {
			const formInput = createTestFormInput();
			const field = createTestField("hash-1", "email");

			const classifiedFields: EnrichedClassifiedField[] = [
				{
					...field,
					classification: "personal.email",
				},
			];

			const autofillResponse: AutofillResponse = {
				"hash-1": {
					fieldName: "email",
					path: "personal.email",
					pathFound: true,
					value: "test@example.com",
				},
			};

			await persistNewFormAndFields(
				formInput,
				classifiedFields,
				classifiedFields,
				TEST_USER_ID,
				TEST_UPLOAD_ID,
				autofillResponse,
				{
					promptTokens: 100,
					completionTokens: 50,
					totalTokens: 150,
				},
			);

			// Check autofill record was saved
			const savedAutofill = await AutofillModel.findOne({
				userId: TEST_USER_ID,
			});
			expect(savedAutofill).not.toBeNull();
			expect(savedAutofill?.userId).toBe(TEST_USER_ID);
			expect(savedAutofill?.uploadReference.toString()).toBe(TEST_UPLOAD_ID);

			// Check autofill data object
			const dataEntry = savedAutofill?.data.find(
				(entry) => entry.hash === "hash-1",
			);
			expect(dataEntry).toBeDefined();
			expect(dataEntry?.fieldName).toBe("email");
			expect(dataEntry?.value).toBe("test@example.com");
		});
	});

	describe("persistNewFormAndFields with file upload fields", () => {
		it("should save autofill record with file upload data", async () => {
			const formInput: FormInput = {
				formHash: "test-form-file-upload",
				fields: [{ hash: "hash-resume" }],
				pageUrl: "https://example.com/apply",
				action: null,
			};

			const resumeField: Field = {
				hash: "hash-resume",
				field: {
					tag: "input",
					type: "file",
					name: "_systemfield_resume",
					label: "Resume",
					placeholder: null,
					description: null,
					isFileUpload: true,
					accept: ".pdf,.docx",
				},
			};

			const classifiedFields: EnrichedClassifiedField[] = [
				{
					...resumeField,
					classification: "resume_upload",
				},
			];

			const autofillResponse: AutofillResponse = {
				"hash-resume": {
					fieldName: "_systemfield_resume",
					path: "resume_upload",
					pathFound: true,
					fileUrl: "https://example.com/presigned-url",
					fileName: "John_Doe_CV.docx",
					fileContentType: "DOCX",
				},
			};

			await persistNewFormAndFields(
				formInput,
				classifiedFields,
				classifiedFields,
				TEST_USER_ID,
				TEST_UPLOAD_ID,
				autofillResponse,
				{ promptTokens: 0, completionTokens: 0, totalTokens: 0 },
			);

			const savedAutofill = await AutofillModel.findOne({
				userId: TEST_USER_ID,
			});
			expect(savedAutofill).not.toBeNull();

			const fileEntry = savedAutofill?.data.find(
				(entry) => entry.hash === "hash-resume",
			);
			expect(fileEntry).toBeDefined();
			expect(fileEntry?.fieldName).toBe("_systemfield_resume");
			expect(fileEntry?.fileUrl).toBe("https://example.com/presigned-url");
			expect(fileEntry?.fileName).toBe("John_Doe_CV.docx");
			expect(fileEntry?.fileContentType).toBe("DOCX");
			expect(fileEntry?.value).toBeUndefined();
		});
	});

	describe("persistCachedAutofill", () => {
		it("should save autofill record with empty usage for cached form", async () => {
			// First create a form and field
			const [savedForm] = await FormModel.create([
				{
					formHash: "cached-form-hash",
					fields: [{ hash: "hash-1", classification: "personal.email" }],
					pageUrls: ["https://example.com"],
					actions: [],
				},
			]);

			await FormFieldModel.create({
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

			const autofillResponse: AutofillResponse = {
				"hash-1": {
					fieldName: "email",
					path: "personal.email",
					pathFound: true,
					value: "cached@example.com",
				},
			};

			await persistCachedAutofill(
				savedForm._id,
				TEST_UPLOAD_ID,
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
