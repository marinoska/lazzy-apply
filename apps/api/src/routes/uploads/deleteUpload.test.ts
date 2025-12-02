import { describe, it, expect, beforeEach, vi } from "vitest";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";
import { deleteUploadController } from "./deleteUpload.controller.js";
import type { FileUploadContentType } from "@lazyapply/types";

describe("Delete Upload", () => {
	let mockReq: any;
	let mockRes: any;
	let jsonMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		jsonMock = vi.fn();
		mockRes = {
			json: jsonMock,
		};
	});

	describe("Successful Deletion", () => {
		it("should mark uploaded file as deleted-by-user", async () => {
			// Create an uploaded file
			const upload = await FileUploadModel.create({
				fileId: "test-file-delete-1",
				objectKey: "test/key-1",
				originalFilename: "test.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "test-user-1",
				status: "uploaded",
				uploadUrlExpiresAt: new Date(Date.now() + 3600000),
			});

			mockReq = {
				params: { fileId: "test-file-delete-1" },
				user: { id: "test-user-1" },
			};

			await deleteUploadController(mockReq, mockRes);

			// Verify the upload was marked as deleted
			const deletedUpload = await FileUploadModel.findOne({
				fileId: "test-file-delete-1",
			}).setOptions({ skipOwnershipEnforcement: true });

			expect(deletedUpload?.status).toBe("deleted-by-user");
			expect(jsonMock).toHaveBeenCalledWith({
				fileId: "test-file-delete-1",
				status: "deleted-by-user",
			});
		});

		it("should mark deduplicated file as deleted-by-user", async () => {
			// Create a deduplicated file
			await FileUploadModel.create({
				fileId: "test-file-delete-2",
				objectKey: "test/key-2",
				originalFilename: "test2.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "test-user-2",
				status: "deduplicated",
				deduplicatedFrom: "original-file-id",
				uploadUrlExpiresAt: new Date(Date.now() + 3600000),
			});

			mockReq = {
				params: { fileId: "test-file-delete-2" },
				user: { id: "test-user-2" },
			};

			await deleteUploadController(mockReq, mockRes);

			// Verify the upload was marked as deleted
			const deletedUpload = await FileUploadModel.findOne({
				fileId: "test-file-delete-2",
			}).setOptions({ skipOwnershipEnforcement: true });

			expect(deletedUpload?.status).toBe("deleted-by-user");
		});

		it("should allow deletion from terminal states", async () => {
			// Create a failed upload (terminal state)
			await FileUploadModel.create({
				fileId: "test-file-delete-3",
				objectKey: "test/key-3",
				originalFilename: "test3.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "test-user-3",
				status: "failed",
				uploadUrlExpiresAt: new Date(Date.now() + 3600000),
			});

			mockReq = {
				params: { fileId: "test-file-delete-3" },
				user: { id: "test-user-3" },
			};

			await deleteUploadController(mockReq, mockRes);

			// Verify the upload was marked as deleted even from failed state
			const deletedUpload = await FileUploadModel.findOne({
				fileId: "test-file-delete-3",
			}).setOptions({ skipOwnershipEnforcement: true });

			expect(deletedUpload?.status).toBe("deleted-by-user");
		});
	});

	describe("Error Handling", () => {
		it("should throw NotFound for non-existent file", async () => {
			mockReq = {
				params: { fileId: "non-existent-file" },
				user: { id: "test-user-4" },
			};

			await expect(
				deleteUploadController(mockReq, mockRes),
			).rejects.toThrow("Upload not found");
		});

		it("should throw NotFound for file owned by different user", async () => {
			// Create upload for user-5
			await FileUploadModel.create({
				fileId: "test-file-delete-5",
				objectKey: "test/key-5",
				originalFilename: "test5.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "test-user-5",
				status: "uploaded",
				uploadUrlExpiresAt: new Date(Date.now() + 3600000),
			});

			// Try to delete as different user
			mockReq = {
				params: { fileId: "test-file-delete-5" },
				user: { id: "different-user" },
			};

			await expect(
				deleteUploadController(mockReq, mockRes),
			).rejects.toThrow("Upload not found");
		});

		it("should throw Unauthorized when user is missing", async () => {
			mockReq = {
				params: { fileId: "test-file-delete-6" },
				user: undefined,
			};

			await expect(
				deleteUploadController(mockReq, mockRes),
			).rejects.toThrow("Missing authenticated user");
		});

		it("should not find pending uploads for deletion", async () => {
			// Create a pending upload
			await FileUploadModel.create({
				fileId: "test-file-delete-7",
				objectKey: "test/key-7",
				originalFilename: "test7.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "quarantine",
				bucket: "test-bucket",
				userId: "test-user-7",
				status: "pending",
				uploadUrlExpiresAt: new Date(Date.now() + 3600000),
			});

			mockReq = {
				params: { fileId: "test-file-delete-7" },
				user: { id: "test-user-7" },
			};

			// Should not find pending uploads (only uploaded/deduplicated can be deleted)
			await expect(
				deleteUploadController(mockReq, mockRes),
			).rejects.toThrow("Upload not found");
		});

		it("should not find already deleted uploads", async () => {
			// Create an already deleted upload
			await FileUploadModel.create({
				fileId: "test-file-delete-8",
				objectKey: "test/key-8",
				originalFilename: "test8.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "test-user-8",
				status: "deleted-by-user",
				uploadUrlExpiresAt: new Date(Date.now() + 3600000),
			});

			mockReq = {
				params: { fileId: "test-file-delete-8" },
				user: { id: "test-user-8" },
			};

			// Should not find already deleted uploads
			await expect(
				deleteUploadController(mockReq, mockRes),
			).rejects.toThrow("Upload not found");
		});
	});
});
