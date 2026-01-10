import type { Field, FormInput } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AutofillModel,
	FormFieldModel,
	FormModel,
} from "@/domain/autofill/index.js";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";
import type { EnrichedClassifiedField } from "../llm/classifier.llm.js";
import { AutofillManager } from "./autofill.manager.js";

// Mock the classifier service to avoid actual AI calls
vi.mock("../llm/classifier.llm.js", () => ({
	classifyFieldsWithAI: vi.fn().mockImplementation((fields: Field[]) => {
		// Return classifications for all fields passed in
		const classifiedFields: EnrichedClassifiedField[] = fields.map((f) => ({
			...f,
			classification: "personal.email" as const,
		}));
		return Promise.resolve({
			classifiedFields,
			usage: {
				promptTokens: 100,
				completionTokens: 50,
				totalTokens: 150,
				inputCost: 0.0001,
				outputCost: 0.00005,
				totalCost: 0.00015,
			},
		});
	}),
}));

// Mock the JD matcher service
vi.mock("../llm/JdFactsExtractor.llm.js", () => ({
	extractJdFormFactsWithAI: vi.fn().mockResolvedValue({
		isMatch: true,
		jdFacts: [],
		routerUsage: null,
		writerUsage: {
			promptTokens: 50,
			completionTokens: 25,
			totalTokens: 75,
			inputCost: 0.00005,
			outputCost: 0.000025,
			totalCost: 0.000075,
		},
	}),
}));

// Mock the inference service
vi.mock("../llm/inference.llm.js", () => ({
	inferFieldValues: vi.fn().mockResolvedValue({
		answers: {},
		usage: {
			promptTokens: 0,
			completionTokens: 0,
			totalTokens: 0,
			inputCost: 0,
			outputCost: 0,
			totalCost: 0,
		},
	}),
}));

// Mock Cloudflare presigned URL generation
vi.mock("@/app/cloudflare.js", () => ({
	getPresignedDownloadUrl: vi
		.fn()
		.mockResolvedValue("https://example.com/presigned-url"),
}));

import { extractJdFormFactsWithAI } from "../llm/JdFactsExtractor.llm.js";

const mockedExtractJdFormFactsWithAI = vi.mocked(extractJdFormFactsWithAI);

const TEST_UPLOAD_ID = "507f1f77bcf86cd799439011";

describe("classification.manager", () => {
	beforeEach(async () => {
		vi.clearAllMocks();

		await FormModel.deleteMany({});
		await FormFieldModel.deleteMany({});
		await AutofillModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		await CVDataModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		await FileUploadModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});

		// Create test file upload
		await FileUploadModel.create({
			_id: TEST_UPLOAD_ID,
			userId: "test-user-id",
			fileId: "test-file-id",
			originalFilename: "test-cv.pdf",
			contentType: "PDF",
			objectKey: "test-object-key",
			directory: "uploads",
			bucket: "test-bucket",
			status: "uploaded",
			isCanonical: true,
		});

		// Create test CV data
		await CVDataModel.createCVData({
			uploadId: TEST_UPLOAD_ID,
			userId: "test-user-id",
			personal: {
				fullName: "Test User",
				email: "test@example.com",
				phone: null,
				location: null,
			},
			links: [],
			headline: null,
			summary: null,
			summaryFacts: [],
			profileSignals: {},
			experience: [],
			education: [],
			certifications: [],
			languages: [],
			extras: {},
			rawText: "Test CV",
		});

		vi.clearAllMocks();
	});

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

	describe("ClassificationManager.process", () => {
		it("should return cached data when form exists", async () => {
			// Create existing field first
			const savedField = await FormFieldModel.create({
				hash: "hash-1",
				field: {
					tag: "input",
					type: "email",
					name: "email",
					label: "Email",
					placeholder: null,
					description: null,
					isFileUpload: false,
					accept: null,
				},
				classification: "personal.email",
			});

			// Create existing form in DB with fieldRef
			await FormModel.create({
				formHash: "test-form-hash",
				fields: [
					{
						hash: "hash-1",
						classification: "personal.email",
						fieldRef: savedField._id,
					},
				],
				pageUrl: "https://example.com/apply",
				action: "https://example.com/submit",
			});

			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			const result = await manager.process({
				jdRawText: "",
				jdUrl: null,
				formUrl: formInput.pageUrl,
				formContext: "",
			});

			expect(result).toBeDefined();
			expect(result.autofillId).toBeDefined();
			expect(result.data).toHaveLength(1);
			expect(result.data[0].fieldName).toBe("email");
			expect(result.data[0].path).toBe("personal.email");
		});

		it("should return cached data when form exists with different URL", async () => {
			// Create existing field first
			const savedField = await FormFieldModel.create({
				hash: "hash-1",
				field: {
					tag: "input",
					type: "email",
					name: "email",
					label: "Email",
					placeholder: null,
					description: null,
					isFileUpload: false,
					accept: null,
				},
				classification: "personal.email",
			});

			await FormModel.create({
				formHash: "test-form-hash",
				fields: [
					{
						hash: "hash-1",
						classification: "personal.email",
						fieldRef: savedField._id,
					},
				],
				pageUrl: "https://example.com/old-page",
				action: null,
			});

			const formInput: FormInput = {
				...createTestFormInput(),
				pageUrl: "https://example.com/new-page",
				action: null,
			};
			const fields = [createTestField("hash-1", "email")];

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			const result = await manager.process({
				jdRawText: "",
				jdUrl: null,
				formUrl: formInput.pageUrl,
				formContext: "",
			});

			// Should still return cached autofill data
			expect(result).toBeDefined();
			expect(result.data).toHaveLength(1);
		});

		it("should use cached fields and classify only missing ones", async () => {
			// Create one cached field
			await FormFieldModel.create({
				hash: "hash-1",
				field: {
					tag: "input",
					type: "email",
					name: "email",
					label: "Email",
					placeholder: null,
					description: null,
					isFileUpload: false,
					accept: null,
				},
				classification: "personal.email",
			});

			const formInput = createTestFormInput();
			formInput.fields = [{ hash: "hash-1" }, { hash: "hash-2" }];

			const fields = [
				createTestField("hash-1", "email"),
				createTestField("hash-2", "phone"),
			];

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			const result = await manager.process({
				jdRawText: "",
				jdUrl: null,
				formUrl: formInput.pageUrl,
				formContext: "",
			});

			// Should have autofill data for both fields (one cached, one classified)
			expect(result.data.length).toBeGreaterThanOrEqual(1);

			// Form should be persisted
			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();
		});

		it("should classify all fields when none are cached", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			const result = await manager.process({
				jdRawText: "",
				jdUrl: null,
				formUrl: formInput.pageUrl,
				formContext: "",
			});

			expect(result.data).toHaveLength(1);

			// Form and field should be persisted
			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();

			const savedField = await FormFieldModel.findOne({ hash: "hash-1" });
			expect(savedField).not.toBeNull();
		});
	});

	describe("JD matching logic", () => {
		it("should skip JD validation when jdUrl matches formUrl (sameUrl)", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];
			const jdUrl = "https://example.com/apply"; // Same as formInput.pageUrl

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			await manager.process({
				jdRawText: "Some JD text",
				jdUrl,
				formUrl: formInput.pageUrl,
				formContext: "",
			});

			// Function is called but detects URL match and skips LLM processing
			expect(mockedExtractJdFormFactsWithAI).toHaveBeenCalledWith({
				jdRawText: "Some JD text",
				formContext: "",
				formFields: expect.any(Array),
				jdUrl,
				formUrl: formInput.pageUrl,
			});
		});

		it("should call JD validation when jdUrl differs from formUrl", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];
			const jdUrl = "https://example.com/job-description"; // Different from formInput.pageUrl

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			await manager.process({
				jdRawText: "Some JD text",
				jdUrl,
				formUrl: formInput.pageUrl,
				formContext: "",
			});

			// validateJdFormMatch should be called when URLs differ
			expect(mockedExtractJdFormFactsWithAI).toHaveBeenCalledWith({
				jdRawText: "Some JD text",
				formContext: "",
				formFields: expect.any(Array),
				jdUrl,
				formUrl: formInput.pageUrl,
			});
		});

		it("should skip JD validation when both jdRawText and formContext are empty", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];
			const jdUrl = "https://example.com/job-description";

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			await manager.process({
				jdRawText: "", // Empty JD text
				jdUrl,
				formUrl: formInput.pageUrl,
				formContext: "", // Empty form context
			});

			// Function is called but returns early without making LLM call
			expect(mockedExtractJdFormFactsWithAI).toHaveBeenCalledWith({
				jdRawText: "",
				formContext: "",
				formFields: expect.any(Array),
				jdUrl,
				formUrl: formInput.pageUrl,
			});
		});

		it("should return isMatch: true when jdUrl matches formUrl (sameUrl fallback)", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];
			const jdUrl = "https://example.com/apply"; // Same as formInput.pageUrl

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			const result = await manager.process({
				jdRawText: "Some JD text",
				jdUrl,
				formUrl: formInput.pageUrl,
				formContext: "",
			});

			// When sameUrl is true, isMatch defaults to true (no validation needed)
			// The autofill should be generated successfully
			expect(result).toBeDefined();
			expect(result.data.length).toBeGreaterThan(0);
		});
	});

	describe("Inference with inferenceHint", () => {
		it("should collect fields with inferenceHint for inference", async () => {
			// Create fields with inferenceHint
			const fieldWithHint = await FormFieldModel.create({
				hash: "hash-unknown-1",
				field: {
					tag: "textarea",
					type: "textarea",
					name: "motivation",
					label: "Why do you want this role?",
					placeholder: null,
					description: null,
					isFileUpload: false,
					accept: null,
				},
				classification: "unknown",
				inferenceHint: "text_from_jd_cv",
			});

			const regularField = await FormFieldModel.create({
				hash: "hash-email",
				field: {
					tag: "input",
					type: "email",
					name: "email",
					label: "Email",
					placeholder: null,
					description: null,
					isFileUpload: false,
					accept: null,
				},
				classification: "personal.email",
			});

			// Create form with both fields
			await FormModel.create({
				formHash: "test-form-hash",
				fields: [
					{
						hash: "hash-unknown-1",
						classification: "unknown",
						inferenceHint: "text_from_jd_cv",
						fieldRef: fieldWithHint._id,
					},
					{
						hash: "hash-email",
						classification: "personal.email",
						fieldRef: regularField._id,
					},
				],
				pageUrl: "https://example.com/apply",
				action: "https://example.com/submit",
			});

			const formInput: FormInput = {
				formHash: "test-form-hash",
				fields: [{ hash: "hash-unknown-1" }, { hash: "hash-email" }],
				pageUrl: "https://example.com/apply",
				action: "https://example.com/submit",
			};

			const fields = [
				{
					hash: "hash-unknown-1",
					field: {
						tag: "textarea",
						type: "textarea",
						name: "motivation",
						label: "Why do you want this role?",
						placeholder: null,
						description: null,
						isFileUpload: false,
						accept: null,
					},
				},
				{
					hash: "hash-email",
					field: {
						tag: "input",
						type: "email",
						name: "email",
						label: "Email",
						placeholder: null,
						description: null,
						isFileUpload: false,
						accept: null,
					},
				},
			];

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});

			const result = await manager.process({
				jdRawText: "We are looking for a motivated developer",
				jdUrl: "https://example.com/job",
				formUrl: "https://example.com/apply",
				formContext: "",
			});

			// Should have autofill data for both fields
			expect(result.data).toHaveLength(2);
			expect(result.data.some((d) => d.hash === "hash-unknown-1")).toBe(true);
			expect(result.data.some((d) => d.hash === "hash-email")).toBe(true);
		});

		it("should not collect fields without inferenceHint even if classification is unknown", async () => {
			// Create field with unknown classification but NO inferenceHint
			const fieldWithoutHint = await FormFieldModel.create({
				hash: "hash-unknown-no-hint",
				field: {
					tag: "input",
					type: "text",
					name: "consent",
					label: "I agree to terms",
					placeholder: null,
					description: null,
					isFileUpload: false,
					accept: null,
				},
				classification: "unknown",
				// No inferenceHint
			});

			await FormModel.create({
				formHash: "test-form-hash",
				fields: [
					{
						hash: "hash-unknown-no-hint",
						classification: "unknown",
						fieldRef: fieldWithoutHint._id,
					},
				],
				pageUrl: "https://example.com/apply",
				action: null,
			});

			const formInput: FormInput = {
				formHash: "test-form-hash",
				fields: [{ hash: "hash-unknown-no-hint" }],
				pageUrl: "https://example.com/apply",
				action: null,
			};

			const fields = [
				{
					hash: "hash-unknown-no-hint",
					field: {
						tag: "input",
						type: "text",
						name: "consent",
						label: "I agree to terms",
						placeholder: null,
						description: null,
						isFileUpload: false,
						accept: null,
					},
				},
			];

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});

			const result = await manager.process({
				jdRawText: "Some job description",
				jdUrl: "https://example.com/job",
				formUrl: "https://example.com/apply",
				formContext: "",
			});

			// Should have autofill data but field should have null value (not inferred)
			expect(result.data).toHaveLength(1);
			expect(result.data[0].value).toBeNull();
		});

		it("should persist inferenceHint when creating new form", async () => {
			// Mock classifier to return field with inferenceHint
			const { classifyFieldsWithAI } = await import("../llm/classifier.llm.js");
			vi.mocked(classifyFieldsWithAI).mockResolvedValueOnce({
				classifiedFields: [
					{
						hash: "hash-motivation",
						field: {
							tag: "textarea",
							type: "textarea",
							name: "motivation",
							label: "Why do you want this role?",
							placeholder: null,
							description: null,
							isFileUpload: false,
							accept: null,
						},
						classification: "unknown" as const,
						inferenceHint: "text_from_jd_cv" as const,
					},
				],
				usage: {
					promptTokens: 100,
					completionTokens: 50,
					totalTokens: 150,
					inputCost: 0.0001,
					outputCost: 0.00005,
					totalCost: 0.00015,
				},
			});

			const formInput: FormInput = {
				formHash: "new-form-hash",
				fields: [{ hash: "hash-motivation" }],
				pageUrl: "https://example.com/apply",
				action: null,
			};

			const fields = [
				{
					hash: "hash-motivation",
					field: {
						tag: "textarea",
						type: "textarea",
						name: "motivation",
						label: "Why do you want this role?",
						placeholder: null,
						description: null,
						isFileUpload: false,
						accept: null,
					},
				},
			];

			const manager = await AutofillManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});

			await manager.process({
				jdRawText: "We need motivated developers",
				jdUrl: "https://example.com/job",
				formUrl: "https://example.com/apply",
				formContext: "",
			});

			// Verify form was persisted with inferenceHint
			const savedForm = await FormModel.findOne({
				formHash: "new-form-hash",
			}).populate("fields.fieldRef");
			expect(savedForm).not.toBeNull();
			expect(savedForm?.fields).toHaveLength(1);
			expect(savedForm?.fields[0].inferenceHint).toBe("text_from_jd_cv");
		});
	});
});
