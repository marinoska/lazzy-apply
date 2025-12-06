import type { FileUploadContentType } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PreferencesModel } from "@/preferences/index.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";
import { updateSelectedUploadController } from "./preferences.controller.js";

describe("updateSelectedUploadController", () => {
	const testUserId = "test-user-preferences";
	let jsonMock: ReturnType<typeof vi.fn>;
	let statusMock: ReturnType<typeof vi.fn>;
	let mockRes: {
		json: ReturnType<typeof vi.fn>;
		status: ReturnType<typeof vi.fn>;
	};

	beforeEach(async () => {
		jsonMock = vi.fn();
		statusMock = vi.fn().mockReturnThis();
		mockRes = { json: jsonMock, status: statusMock };

		// Clean up test data
		await PreferencesModel.deleteMany({ userId: testUserId });
		await FileUploadModel.deleteMany({}).setOptions({
			skipOwnershipEnforcement: true,
		});
	});

	const createUpload = async (fileId: string) => {
		return FileUploadModel.create({
			fileId,
			objectKey: `test/${fileId}`,
			originalFilename: `${fileId}.pdf`,
			contentType: "PDF" as FileUploadContentType,
			directory: "cv",
			bucket: "test-bucket",
			userId: testUserId,
			status: "uploaded",
		});
	};

	it("should update selected upload preference", async () => {
		const upload = await createUpload("file-update-1");
		const uploadId = upload._id.toString();

		const mockReq = {
			user: { id: testUserId },
			body: { selectedUploadId: uploadId },
		};

		await updateSelectedUploadController(mockReq as never, mockRes as never);

		expect(jsonMock).toHaveBeenCalledWith({
			selectedUploadId: uploadId,
		});

		// Verify it was persisted
		const prefs = await PreferencesModel.findByUserId(testUserId);
		expect(prefs?.selectedUploadId?.toString()).toBe(uploadId);
	});

	it("should clear selected upload when null is passed", async () => {
		const upload = await createUpload("file-clear-1");
		await PreferencesModel.upsertSelectedUpload(testUserId, upload._id);

		const mockReq = {
			user: { id: testUserId },
			body: { selectedUploadId: null },
		};

		await updateSelectedUploadController(mockReq as never, mockRes as never);

		expect(jsonMock).toHaveBeenCalledWith({ selectedUploadId: null });

		const prefs = await PreferencesModel.findByUserId(testUserId);
		expect(prefs?.selectedUploadId).toBeNull();
	});

	it("should return 404 when upload does not exist", async () => {
		const mockReq = {
			user: { id: testUserId },
			body: { selectedUploadId: "507f1f77bcf86cd799439011" }, // Valid ObjectId format but doesn't exist
		};

		await updateSelectedUploadController(mockReq as never, mockRes as never);

		expect(statusMock).toHaveBeenCalledWith(404);
		expect(jsonMock).toHaveBeenCalledWith({ selectedUploadId: null });
	});

	it("should return 400 for invalid ObjectId format", async () => {
		const mockReq = {
			user: { id: testUserId },
			body: { selectedUploadId: "invalid-id" },
		};

		await updateSelectedUploadController(mockReq as never, mockRes as never);

		expect(statusMock).toHaveBeenCalledWith(400);
		expect(jsonMock).toHaveBeenCalledWith({ selectedUploadId: null });
	});

	it("should throw Unauthorized when user is missing", async () => {
		const mockReq = {
			user: undefined,
			body: { selectedUploadId: "file-1" },
		};

		await expect(
			updateSelectedUploadController(mockReq as never, mockRes as never),
		).rejects.toThrow("Missing authenticated user");
	});

	it("should not allow selecting another user's upload", async () => {
		// Create upload for different user
		const otherUpload = await FileUploadModel.create({
			fileId: "other-user-file",
			objectKey: "test/other-user-file",
			originalFilename: "other.pdf",
			contentType: "PDF" as FileUploadContentType,
			directory: "cv",
			bucket: "test-bucket",
			userId: "other-user-id",
			status: "uploaded",
		});

		const mockReq = {
			user: { id: testUserId },
			body: { selectedUploadId: otherUpload._id.toString() },
		};

		await updateSelectedUploadController(mockReq as never, mockRes as never);

		expect(statusMock).toHaveBeenCalledWith(404);
	});
});
