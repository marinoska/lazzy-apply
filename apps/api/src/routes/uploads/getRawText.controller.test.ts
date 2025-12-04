import type { FileUploadContentType } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";
import { getRawTextController } from "./getRawText.controller.js";

describe("getRawTextController", () => {
	let mockReq: {
		params: {
			uploadId: string;
		};
	};
	let mockRes: {
		status: ReturnType<typeof vi.fn>;
		json: ReturnType<typeof vi.fn>;
	};
	let statusMock: ReturnType<typeof vi.fn>;
	let jsonMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		jsonMock = vi.fn();
		statusMock = vi.fn().mockReturnValue({ json: jsonMock });
		mockRes = {
			status: statusMock,
			json: jsonMock,
		};
	});

	describe("Successful Retrieval", () => {
		it("should return rawText for valid upload", async () => {
			const rawText =
				"John Doe\nSoftware Engineer\nExperience: 5 years\nSkills: TypeScript, React";

			// Create upload with rawText (canonical for worker processing)
			const upload = await FileUploadModel.create({
				fileId: `test-rawtext-${Date.now()}-1`,
				objectKey: "cv/test-1",
				originalFilename: "resume.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "user-rawtext-1",
				userEmail: "rawtext@example.com",
				status: "uploaded",
				size: 1024000,
				rawTextSize: rawText.length,
				rawText,
				isCanonical: true,
			});

			mockReq = {
				params: { uploadId: upload._id.toString() },
			};

			await getRawTextController(mockReq as never, mockRes as never);

			expect(statusMock).toHaveBeenCalledWith(200);
			expect(jsonMock).toHaveBeenCalledWith({
				rawText,
			});
		});

		it("should return rawText regardless of upload status", async () => {
			const rawText = "CV content for processing";

			// Create canonical upload that's already being processed
			const upload = await FileUploadModel.create({
				fileId: `test-rawtext-${Date.now()}-2`,
				objectKey: "cv/test-2",
				originalFilename: "resume.docx",
				contentType: "DOCX" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "user-rawtext-2",
				userEmail: "rawtext2@example.com",
				status: "uploaded", // Could be any status
				size: 512000,
				rawTextSize: rawText.length,
				rawText,
				isCanonical: true,
			});

			mockReq = {
				params: { uploadId: upload._id.toString() },
			};

			await getRawTextController(mockReq as never, mockRes as never);

			expect(statusMock).toHaveBeenCalledWith(200);
			expect(jsonMock).toHaveBeenCalledWith({ rawText });
		});

		it("should skip ownership enforcement (worker access)", async () => {
			const rawText = "Worker accessible content";

			// Create canonical upload for a specific user
			const upload = await FileUploadModel.create({
				fileId: `test-rawtext-${Date.now()}-3`,
				objectKey: "cv/test-3",
				originalFilename: "cv.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "user-rawtext-3",
				userEmail: "rawtext3@example.com",
				status: "uploaded",
				size: 256000,
				rawTextSize: rawText.length,
				rawText,
				isCanonical: true,
			});

			// Request without user context (worker request)
			mockReq = {
				params: { uploadId: upload._id.toString() },
			};

			// Should succeed without user context since skipOwnershipEnforcement is true
			await getRawTextController(mockReq as never, mockRes as never);

			expect(statusMock).toHaveBeenCalledWith(200);
		});
	});

	describe("Error Handling", () => {
		it("should return 404 for non-existent upload", async () => {
			mockReq = {
				params: { uploadId: "507f1f77bcf86cd799439011" }, // Valid ObjectId format
			};

			await getRawTextController(mockReq as never, mockRes as never);

			expect(statusMock).toHaveBeenCalledWith(404);
			expect(jsonMock).toHaveBeenCalledWith({ error: "Upload not found" });
		});

		it("should return 404 when rawText is not available", async () => {
			// Create canonical upload without rawText (e.g., legacy upload)
			const upload = await FileUploadModel.create({
				fileId: `test-rawtext-${Date.now()}-4`,
				objectKey: "cv/test-4",
				originalFilename: "old-resume.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "user-rawtext-4",
				userEmail: "rawtext4@example.com",
				status: "uploaded",
				size: 1000000,
				isCanonical: true,
				// No rawText field
			});

			mockReq = {
				params: { uploadId: upload._id.toString() },
			};

			await getRawTextController(mockReq as never, mockRes as never);

			expect(statusMock).toHaveBeenCalledWith(404);
			expect(jsonMock).toHaveBeenCalledWith({
				error: "Raw text not available",
			});
		});

		it("should return 404 for invalid ObjectId format", async () => {
			mockReq = {
				params: { uploadId: "invalid-id" },
			};

			// MongoDB will throw CastError for invalid ObjectId
			await expect(
				getRawTextController(mockReq as never, mockRes as never),
			).rejects.toThrow();
		});

		it("should return 409 for non-canonical upload", async () => {
			const rawText = "Non-canonical content";

			// Create non-canonical upload (e.g., deduplicated or replaced)
			const upload = await FileUploadModel.create({
				fileId: `test-rawtext-${Date.now()}-noncanonical`,
				objectKey: "cv/test-noncanonical",
				originalFilename: "duplicate.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "user-rawtext-noncanonical",
				userEmail: "noncanonical@example.com",
				status: "deduplicated",
				size: 1000000,
				rawTextSize: rawText.length,
				rawText,
				isCanonical: false, // Non-canonical - should be rejected
			});

			mockReq = {
				params: { uploadId: upload._id.toString() },
			};

			await getRawTextController(mockReq as never, mockRes as never);

			expect(statusMock).toHaveBeenCalledWith(409);
			expect(jsonMock).toHaveBeenCalledWith({
				error: "Upload is not canonical - processing not allowed",
			});
		});
	});

	describe("Large Text Handling", () => {
		it("should handle large rawText content", async () => {
			// Create large text (close to 80KB limit)
			const largeText = "A".repeat(80000);

			const upload = await FileUploadModel.create({
				fileId: `test-rawtext-${Date.now()}-5`,
				objectKey: "cv/test-5",
				originalFilename: "large-cv.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "user-rawtext-5",
				userEmail: "rawtext5@example.com",
				status: "uploaded",
				size: 4000000,
				rawTextSize: largeText.length,
				rawText: largeText,
				isCanonical: true,
			});

			mockReq = {
				params: { uploadId: upload._id.toString() },
			};

			await getRawTextController(mockReq as never, mockRes as never);

			expect(statusMock).toHaveBeenCalledWith(200);
			expect(jsonMock).toHaveBeenCalledWith({ rawText: largeText });
		});
	});
});
