import type { Field } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as cloudflare from "@/app/cloudflare.js";
import { AutofillModel } from "@/domain/autofill/model/autofill.model.js";
import { FormModel } from "@/domain/autofill/model/form.model.js";
import { FormFieldModel } from "@/domain/autofill/model/formField.model.js";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";
import type { EnrichedClassifiedField } from "../services/classifier.service.js";
import { autofill } from "./autofill.controller.js";

// Mock env to have OPENAI_API_KEY and LOG_LEVEL
vi.mock("@/app/env.js", () => ({
	env: {
		OPENAI_API_KEY: "test-key",
		OPENAI_MODEL: "gpt-4",
		OPENAI_MODEL_INPUT_PRICE_PER_1M: 0.01,
		OPENAI_MODEL_OUTPUT_PRICE_PER_1M: 0.03,
		LOG_LEVEL: "silent",
		NODE_ENV: "test",
		CLOUDFLARE_BUCKET: "test-bucket",
	},
	getEnv: (key: string) => {
		if (key === "CLOUDFLARE_BUCKET") return "test-bucket";
		return undefined;
	},
}));

vi.mock("@/app/cloudflare.js", () => ({
	getPresignedDownloadUrl: vi.fn(),
}));

// Mock the classifier service to avoid actual AI calls
vi.mock("../services/classifier.service.js", () => ({
	classifyFieldsWithAI: vi.fn().mockImplementation((fields: Field[]) => {
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

const TEST_UPLOAD_ID = "507f1f77bcf86cd799439011";

describe("autofill.controller", () => {
	let mockReq: {
		user: { id: string };
		body: {
			form: {
				formHash: string;
				fields: Array<{ hash: string }>;
				pageUrl: string;
				action: string | null;
			};
			fields: Array<{
				hash: string;
				field: {
					tag: string;
					type: string;
					name: string | null;
					label: string | null;
					placeholder: string | null;
					description: string | null;
					isFileUpload: boolean;
					accept: string | null;
				};
			}>;
			selectedUploadId: string;
		};
	};
	let mockRes: {
		json: ReturnType<typeof vi.fn>;
	};

	beforeEach(async () => {
		await FormModel.deleteMany({});
		await FormFieldModel.deleteMany({});
		await AutofillModel.deleteMany({});
		await FileUploadModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
		await CVDataModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});

		// Create test file upload (required by loadCVData)
		await FileUploadModel.create({
			_id: TEST_UPLOAD_ID,
			userId: "test-user-id",
			fileId: "test-file-id",
			objectKey: "cv/test-cv.pdf",
			originalFilename: "test-cv.pdf",
			contentType: "PDF",
			size: 12345,
			status: "uploaded",
			bucket: "test-bucket",
			directory: "cv",
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

		mockRes = {
			json: vi.fn(),
		};

		mockReq = {
			user: { id: "test-user-id" },
			body: {
				form: {
					formHash: "test-form-hash",
					fields: [{ hash: "hash-1" }],
					pageUrl: "https://example.com/apply",
					action: "https://example.com/submit",
				},
				fields: [
					{
						hash: "hash-1",
						field: {
							tag: "input",
							type: "email",
							name: "email",
							label: "Email Address",
							placeholder: "Enter your email",
							description: null,
							isFileUpload: false,
							accept: null,
						},
					},
				],
				selectedUploadId: TEST_UPLOAD_ID,
			},
		};
	});

	describe("autofill", () => {
		it("should return cached response when form exists", async () => {
			// Create existing field first
			const savedField = await FormFieldModel.create({
				hash: "hash-1",
				field: {
					tag: "input",
					type: "email",
					name: "email",
					label: "Email Address",
					placeholder: "Enter your email",
					description: null,
					isFileUpload: false,
					accept: null,
				},
				classification: "personal.email",
			});

			// Create existing form with fieldRef
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

			await autofill(mockReq as never, mockRes as never);

			expect(mockRes.json).toHaveBeenCalled();
			const response = mockRes.json.mock.calls[0][0];
			expect(response.fromCache).toBe(true);
			expect(response.autofillId).toBeDefined();
			expect(response.fields["hash-1"]).toEqual({
				fieldName: "email",
				path: "personal.email",
				pathFound: true,
				value: "test@example.com",
			});
		});

		it("should classify and return response when form does not exist", async () => {
			await autofill(mockReq as never, mockRes as never);

			expect(mockRes.json).toHaveBeenCalled();
			const response = mockRes.json.mock.calls[0][0];
			expect(typeof response).toBe("object");
			expect(Object.keys(response).length).toBeGreaterThanOrEqual(1);
		});

		it("should persist form after classification", async () => {
			await autofill(mockReq as never, mockRes as never);

			const savedForm = await FormModel.findOne({ formHash: "test-form-hash" });
			expect(savedForm).not.toBeNull();
			expect(savedForm?.pageUrls).toContain("https://example.com/apply");
		});

		it("should generate fresh presigned URL for file fields in cached response", async () => {
			// Create file upload for this test (different from beforeEach one)
			const fileUpload = await FileUploadModel.create({
				userId: "test-user-id",
				fileId: "test-file-id-2",
				objectKey: "cv/test-cv-file-field.pdf",
				originalFilename: "my-resume.pdf",
				contentType: "PDF",
				size: 12345,
				status: "uploaded",
				bucket: "test-bucket",
				directory: "cv",
			});

			// Create field with file upload classification
			const savedField = await FormFieldModel.create({
				hash: "hash-file",
				field: {
					tag: "input",
					type: "file",
					name: "resume",
					label: "Upload Resume",
					placeholder: null,
					description: null,
					isFileUpload: true,
					accept: ".pdf,.docx",
				},
				classification: "resume_upload",
			});

			// Create form
			const form = await FormModel.create({
				formHash: "test-form-hash-file",
				fields: [
					{
						hash: "hash-file",
						classification: "resume_upload",
						fieldRef: savedField._id,
					},
				],
				pageUrls: ["https://example.com/apply"],
				actions: [],
			});

			// Create cached autofill with OLD expired presigned URL
			await AutofillModel.create({
				autofillId: "cached-autofill-id",
				formReference: form._id,
				uploadReference: fileUpload._id,
				userId: "test-user-id",
				data: [
					{
						hash: "hash-file",
						fieldRef: savedField._id,
						fieldName: "resume",
						fileUrl: "https://old-expired-url.com/file.pdf",
						fileName: "my-resume.pdf",
						fileContentType: "PDF",
					},
				],
			});

			// Mock fresh presigned URL generation
			const freshUrl = "https://fresh-presigned-url.com/file.pdf";
			vi.mocked(cloudflare.getPresignedDownloadUrl).mockResolvedValue(freshUrl);

			// Make request with file field
			const fileReq = {
				user: { id: "test-user-id" },
				body: {
					form: {
						formHash: "test-form-hash-file",
						fields: [{ hash: "hash-file" }],
						pageUrl: "https://example.com/apply",
						action: null,
					},
					fields: [
						{
							hash: "hash-file",
							field: {
								tag: "input",
								type: "file",
								name: "resume",
								label: "Upload Resume",
								placeholder: null,
								description: null,
								isFileUpload: true,
								accept: ".pdf,.docx",
							},
						},
					],
					selectedUploadId: TEST_UPLOAD_ID,
				},
			};

			await autofill(fileReq as never, mockRes as never);

			expect(mockRes.json).toHaveBeenCalled();
			const response = mockRes.json.mock.calls[0][0];

			// Should return cached response with FRESH presigned URL, not the old expired one
			expect(response.fromCache).toBe(true);
			expect(cloudflare.getPresignedDownloadUrl).toHaveBeenCalledWith(
				"test-bucket",
				"cv/test-cv.pdf",
			);
			expect(response.fields["hash-file"].fileUrl).toBe(freshUrl);
			expect(response.fields["hash-file"].fileUrl).not.toBe(
				"https://old-expired-url.com/file.pdf",
			);
		});
	});
});
