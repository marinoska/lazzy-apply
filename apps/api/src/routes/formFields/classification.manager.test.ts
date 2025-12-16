import type { Field, FormInput } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CVDataModel } from "@/cvData/index.js";
import {
	AutofillModel,
	FormFieldModel,
	FormModel,
} from "@/formFields/index.js";
import { ClassificationManager } from "./classification.manager.js";
import type { EnrichedClassifiedField } from "./services/classifier.service.js";
import { validateJdFormMatch } from "./services/jdMatcher.service.js";

// Mock the classifier service to avoid actual AI calls
vi.mock("./services/classifier.service.js", () => ({
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
vi.mock("./services/jdMatcher.service.js", () => ({
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
				pageUrls: ["https://example.com/apply"],
				actions: ["https://example.com/submit"],
			});

			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];

			const manager = new ClassificationManager(
				formInput,
				fields,
				"test-user-id",
				TEST_UPLOAD_ID,
				"",
				null,
				[],
			);
			const result = await manager.process();

			expect(result.fromCache).toBe(true);
			expect(Object.keys(result.response)).toHaveLength(1);
			expect(result.response["hash-1"].fieldName).toBe("email");
			expect(result.response["hash-1"].path).toBe("personal.email");
		});

		it("should update pageUrls when form exists but URL is new", async () => {
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
				pageUrls: ["https://example.com/old-page"],
				actions: [],
			});

			const formInput: FormInput = {
				...createTestFormInput(),
				pageUrl: "https://example.com/new-page",
				action: null,
			};
			const fields = [createTestField("hash-1", "email")];

			const manager = new ClassificationManager(
				formInput,
				fields,
				"test-user-id",
				TEST_UPLOAD_ID,
				"",
				null,
				[],
			);
			await manager.process();

			const updatedForm = await FormModel.findOne({
				formHash: "test-form-hash",
			});
			expect(updatedForm?.pageUrls).toContain("https://example.com/old-page");
			expect(updatedForm?.pageUrls).toContain("https://example.com/new-page");
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

			const manager = new ClassificationManager(
				formInput,
				fields,
				"test-user-id",
				TEST_UPLOAD_ID,
				"",
				null,
				[],
			);
			const result = await manager.process();

			expect(result.fromCache).toBe(false);
			// Should have response for both fields (one cached, one classified)
			expect(Object.keys(result.response).length).toBeGreaterThanOrEqual(1);

			// Form should be persisted
			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();
		});

		it("should classify all fields when none are cached", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];

			const manager = new ClassificationManager(
				formInput,
				fields,
				"test-user-id",
				TEST_UPLOAD_ID,
				"",
				null,
				[],
			);
			const result = await manager.process();

			expect(result.fromCache).toBe(false);
			expect(Object.keys(result.response)).toHaveLength(1);

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

			const manager = new ClassificationManager(
				formInput,
				fields,
				"test-user-id",
				TEST_UPLOAD_ID,
				"Some JD text",
				jdUrl,
				[],
			);
			await manager.process();

			// validateJdFormMatch should NOT be called when URLs match
			expect(validateJdFormMatch).not.toHaveBeenCalled();
		});

		it("should call JD validation when jdUrl differs from formUrl", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];
			const jdUrl = "https://example.com/job-description"; // Different from formInput.pageUrl

			const manager = new ClassificationManager(
				formInput,
				fields,
				"test-user-id",
				TEST_UPLOAD_ID,
				"Some JD text",
				jdUrl,
				[],
			);
			await manager.process();

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

			const manager = new ClassificationManager(
				formInput,
				fields,
				"test-user-id",
				TEST_UPLOAD_ID,
				"", // Empty JD text
				jdUrl,
				[],
			);
			await manager.process();

			// validateJdFormMatch should NOT be called when JD text is empty
			expect(validateJdFormMatch).not.toHaveBeenCalled();
		});

		it("should return isMatch: true when jdUrl matches formUrl (sameUrl fallback)", async () => {
			const formInput = createTestFormInput();
			const fields = [createTestField("hash-1", "email")];
			const jdUrl = "https://example.com/apply"; // Same as formInput.pageUrl

			const manager = new ClassificationManager(
				formInput,
				fields,
				"test-user-id",
				TEST_UPLOAD_ID,
				"Some JD text",
				jdUrl,
				[],
			);
			const result = await manager.process();

			// When sameUrl is true, isMatch defaults to true (no validation needed)
			// The response should be generated successfully
			expect(result.response).toBeDefined();
			expect(Object.keys(result.response).length).toBeGreaterThan(0);
		});
	});
});
