import type { FileUploadContentType } from "@lazyapply/types";
import type { Types } from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesModel } from "@/domain/preferences/index.js";
import { FileUploadModel } from "@/domain/uploads/model/fileUpload.model.js";
import { deleteUploadController } from "./deleteUpload.controller.js";

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
			const _upload = await FileUploadModel.create({
				fileId: "test-file-delete-1",
				objectKey: "test/key-1",
				originalFilename: "test.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "test-user-1",
				status: "uploaded",
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
			// Create a canonical file first
			const canonicalUpload = await FileUploadModel.create({
				fileId: "canonical-file-for-delete-test",
				objectKey: "test/canonical-key",
				originalFilename: "canonical.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "test-user-2",
				status: "uploaded",
				isCanonical: true,
			});

			// Create a deduplicated file referencing the canonical
			await FileUploadModel.create({
				fileId: "test-file-delete-2",
				objectKey: "test/key-2",
				originalFilename: "test2.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "test-user-2",
				status: "deduplicated",
				deduplicatedFrom: canonicalUpload._id,
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

		it("should allow deletion from failed state", async () => {
			await FileUploadModel.create({
				fileId: "test-file-delete-3",
				objectKey: "test/key-3",
				originalFilename: "test3.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "test-user-3",
				status: "failed",
			});

			mockReq = {
				params: { fileId: "test-file-delete-3" },
				user: { id: "test-user-3" },
			};

			await deleteUploadController(mockReq, mockRes);

			const deletedUpload = await FileUploadModel.findOne({
				fileId: "test-file-delete-3",
			}).setOptions({ skipOwnershipEnforcement: true });

			expect(deletedUpload?.status).toBe("deleted-by-user");
		});

		it("should allow deletion from rejected state", async () => {
			await FileUploadModel.create({
				fileId: "test-file-delete-rejected",
				objectKey: "test/key-rejected",
				originalFilename: "test-rejected.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId: "test-user-rejected",
				status: "rejected",
				rejectionReason: "Invalid file",
			});

			mockReq = {
				params: { fileId: "test-file-delete-rejected" },
				user: { id: "test-user-rejected" },
			};

			await deleteUploadController(mockReq, mockRes);

			const deletedUpload = await FileUploadModel.findOne({
				fileId: "test-file-delete-rejected",
			}).setOptions({ skipOwnershipEnforcement: true });

			expect(deletedUpload?.status).toBe("deleted-by-user");
		});

		it("should clear selectedUploadId from preferences when deleting selected upload", async () => {
			const userId = "test-user-pref-clear";

			// Create an uploaded file
			const upload = await FileUploadModel.create({
				fileId: "test-file-delete-pref",
				objectKey: "test/key-pref",
				originalFilename: "test-pref.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId,
				status: "uploaded",
			});

			// Set this upload as selected in preferences
			await PreferencesModel.upsertSelectedUpload(
				userId,
				upload._id as unknown as Types.ObjectId,
			);

			// Verify it's set
			const prefsBefore = await PreferencesModel.findByUserId(userId);
			expect(prefsBefore?.selectedUploadId?.toString()).toBe(
				upload._id.toString(),
			);

			mockReq = {
				params: { fileId: "test-file-delete-pref" },
				user: { id: userId },
			};

			await deleteUploadController(mockReq, mockRes);

			// Verify preference was cleared
			const prefsAfter = await PreferencesModel.findByUserId(userId);
			expect(prefsAfter?.selectedUploadId).toBeNull();
		});

		it("should not clear selectedUploadId when deleting a different upload", async () => {
			const userId = "test-user-pref-keep";

			// Create two uploaded files
			const selectedUpload = await FileUploadModel.create({
				fileId: "test-file-selected",
				objectKey: "test/key-selected",
				originalFilename: "selected.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId,
				status: "uploaded",
			});

			await FileUploadModel.create({
				fileId: "test-file-to-delete",
				objectKey: "test/key-to-delete",
				originalFilename: "to-delete.pdf",
				contentType: "PDF" as FileUploadContentType,
				directory: "cv",
				bucket: "test-bucket",
				userId,
				status: "uploaded",
			});

			// Set the first upload as selected
			await PreferencesModel.upsertSelectedUpload(
				userId,
				selectedUpload._id as unknown as Types.ObjectId,
			);

			mockReq = {
				params: { fileId: "test-file-to-delete" },
				user: { id: userId },
			};

			// Delete the second upload
			await deleteUploadController(mockReq, mockRes);

			// Verify preference still points to the first upload
			const prefsAfter = await PreferencesModel.findByUserId(userId);
			expect(prefsAfter?.selectedUploadId?.toString()).toBe(
				selectedUpload._id.toString(),
			);
		});
	});

	describe("Error Handling", () => {
		it("should throw NotFound for non-existent file", async () => {
			mockReq = {
				params: { fileId: "non-existent-file" },
				user: { id: "test-user-4" },
			};

			await expect(deleteUploadController(mockReq, mockRes)).rejects.toThrow(
				"Upload not found",
			);
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
			});

			// Try to delete as different user
			mockReq = {
				params: { fileId: "test-file-delete-5" },
				user: { id: "different-user" },
			};

			await expect(deleteUploadController(mockReq, mockRes)).rejects.toThrow(
				"Upload not found",
			);
		});

		it("should throw Unauthorized when user is missing", async () => {
			mockReq = {
				params: { fileId: "test-file-delete-6" },
				user: undefined,
			};

			await expect(deleteUploadController(mockReq, mockRes)).rejects.toThrow(
				"Missing authenticated user",
			);
		});

		it("should allow deletion of pending uploads", async () => {
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
			});

			mockReq = {
				params: { fileId: "test-file-delete-7" },
				user: { id: "test-user-7" },
			};

			await deleteUploadController(mockReq, mockRes);

			const deletedUpload = await FileUploadModel.findOne({
				fileId: "test-file-delete-7",
			}).setOptions({ skipOwnershipEnforcement: true });

			expect(deletedUpload?.status).toBe("deleted-by-user");
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
			});

			mockReq = {
				params: { fileId: "test-file-delete-8" },
				user: { id: "test-user-8" },
			};

			// Should not find already deleted uploads
			await expect(deleteUploadController(mockReq, mockRes)).rejects.toThrow(
				"Upload not found",
			);
		});
	});
});
