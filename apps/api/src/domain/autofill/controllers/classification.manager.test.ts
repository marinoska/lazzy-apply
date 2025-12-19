import type { Field, FormInput } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AutofillModel,
	FormFieldModel,
	FormModel,
} from "@/domain/autofill/index.js";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";
import type { EnrichedClassifiedField } from "../services/classifier.service.js";
import { validateJdFormMatch } from "../services/jdMatcher.service.js";
import { ClassificationManager } from "./classification.manager.js";

// Mock the classifier service to avoid actual AI calls
vi.mock("../services/classifier.service.js", () => ({
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
vi.mock("../services/jdMatcher.service.js", () => ({
	validateJdFormMatch: vi.fn().mockResolvedValue({
		isMatch: true,
		usage: {
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
vi.mock("./services/inference.service.js", () => ({
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

const TEST_UPLOAD_ID = "507f1f77bcf86cd799439011";

describe("classification.manager", () => {
	beforeEach(async () => {
		await FormModel.deleteMany({});
		await FormFieldModel.deleteMany({});
		await AutofillModel.deleteMany({});
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

			const manager = await ClassificationManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			const result = await manager.process({
				jdRawText: "",
				jdUrl: null,
				formUrl: formInput.pageUrl,
				formContext: [],
			});

			expect(result.autofill).toBeDefined();
			expect(result.autofill.autofillId).toBeDefined();
			expect(result.autofill.data).toHaveLength(1);
			expect(result.autofill.data[0].fieldName).toBe("email");
			expect(result.autofill.data[0].path).toBe("personal.email");
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

			const manager = await ClassificationManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			const result = await manager.process({
				jdRawText: "",
				jdUrl: null,
				formUrl: formInput.pageUrl,
				formContext: [],
			});

			// Should still return cached autofill data
			expect(result.autofill).toBeDefined();
			expect(result.autofill.data).toHaveLength(1);
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

			const manager = await ClassificationManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			const result = await manager.process({
				jdRawText: "",
				jdUrl: null,
				formUrl: formInput.pageUrl,
				formContext: [],
			});

			// Should have autofill data for both fields (one cached, one classified)
			expect(result.autofill.data.length).toBeGreaterThanOrEqual(1);

			// Form should be persisted
			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();
		});

		it("should classify all fields when none are cached", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];

			const manager = await ClassificationManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			const result = await manager.process({
				jdRawText: "",
				jdUrl: null,
				formUrl: formInput.pageUrl,
				formContext: [],
			});

			expect(result.autofill.data).toHaveLength(1);

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

			const manager = await ClassificationManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			await manager.process({
				jdRawText: "Some JD text",
				jdUrl,
				formUrl: formInput.pageUrl,
				formContext: [],
			});

			// validateJdFormMatch should NOT be called when URLs match
			expect(validateJdFormMatch).not.toHaveBeenCalled();
		});

		it("should call JD validation when jdUrl differs from formUrl", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];
			const jdUrl = "https://example.com/job-description"; // Different from formInput.pageUrl

			const manager = await ClassificationManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			await manager.process({
				jdRawText: "Some JD text",
				jdUrl,
				formUrl: formInput.pageUrl,
				formContext: [],
			});

			// validateJdFormMatch should be called when URLs differ
			expect(validateJdFormMatch).toHaveBeenCalledWith({
				jdText: "Some JD text",
				formFields: fields,
				jdUrl: jdUrl,
				formUrl: formInput.pageUrl,
			});
		});

		it("should skip JD validation when jdRawText is empty", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];
			const jdUrl = "https://example.com/job-description";

			const manager = await ClassificationManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			await manager.process({
				jdRawText: "", // Empty JD text
				jdUrl,
				formUrl: formInput.pageUrl,
				formContext: [],
			});

			// validateJdFormMatch should NOT be called when JD text is empty
			expect(validateJdFormMatch).not.toHaveBeenCalled();
		});

		it("should return isMatch: true when jdUrl matches formUrl (sameUrl fallback)", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];
			const jdUrl = "https://example.com/apply"; // Same as formInput.pageUrl

			const manager = await ClassificationManager.create({
				formInput,
				fieldsInput: fields,
				userId: "test-user-id",
				selectedUploadId: TEST_UPLOAD_ID,
			});
			const result = await manager.process({
				jdRawText: "Some JD text",
				jdUrl,
				formUrl: formInput.pageUrl,
				formContext: [],
			});

			// When sameUrl is true, isMatch defaults to true (no validation needed)
			// The autofill should be generated successfully
			expect(result.autofill).toBeDefined();
			expect(result.autofill.data.length).toBeGreaterThan(0);
		});
	});
});
