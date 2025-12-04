import type { FileUploadContentType } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OutboxModel } from "@/outbox/index.js";
import { FileUploadModel } from "@/uploads/fileUpload.model.js";
import { getUploadsController } from "./getUploads.controller.js";

describe("getUploadsController", () => {
	let mockReq: { query: Record<string, string>; user?: { id: string } };
	let mockRes: { json: ReturnType<typeof vi.fn> };
	let jsonMock: ReturnType<typeof vi.fn>;

	const testUserId = "test-user-uploads";

	beforeEach(() => {
		jsonMock = vi.fn();
		mockRes = { json: jsonMock };
		mockReq = {
			query: { limit: "10", offset: "0" },
			user: { id: testUserId },
		};
	});

	const createUpload = async (
		fileId: string,
		status: "uploaded" | "deduplicated" | "pending" | "failed" = "uploaded",
	) => {
		return FileUploadModel.create({
			fileId,
			objectKey: `test/${fileId}`,
			originalFilename: `${fileId}.pdf`,
			contentType: "PDF" as FileUploadContentType,
			directory: "cv",
			bucket: "test-bucket",
			userId: testUserId,
			status,
			uploadUrlExpiresAt: new Date(Date.now() + 3600000),
		});
	};

	const createOutboxEntry = async (
		fileId: string,
		status: "pending" | "processing" | "completed" | "failed",
	) => {
		return OutboxModel.create({
			processId: `process-${fileId}-${status}`,
			type: "file_upload",
			uploadId: `upload-${fileId}`,
			fileId,
			userId: testUserId,
			fileType: "PDF",
			status,
		});
	};

	describe("parseStatus field", () => {
		it("should return parseStatus 'completed' for uploads with completed outbox entry", async () => {
			await createUpload("file-completed-1");
			await createOutboxEntry("file-completed-1", "completed");

			await getUploadsController(mockReq as never, mockRes as never);

			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					uploads: expect.arrayContaining([
						expect.objectContaining({
							fileId: "file-completed-1",
							parseStatus: "completed",
						}),
					]),
				}),
			);
		});

		it("should return parseStatus 'processing' for uploads currently being processed", async () => {
			await createUpload("file-processing-1");
			await createOutboxEntry("file-processing-1", "processing");

			await getUploadsController(mockReq as never, mockRes as never);

			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					uploads: expect.arrayContaining([
						expect.objectContaining({
							fileId: "file-processing-1",
							parseStatus: "processing",
						}),
					]),
				}),
			);
		});

		it("should return parseStatus 'failed' for uploads with failed parsing", async () => {
			await createUpload("file-failed-1");
			await createOutboxEntry("file-failed-1", "failed");

			await getUploadsController(mockReq as never, mockRes as never);

			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					uploads: expect.arrayContaining([
						expect.objectContaining({
							fileId: "file-failed-1",
							parseStatus: "failed",
						}),
					]),
				}),
			);
		});

		it("should return parseStatus 'pending' for uploads with pending outbox entry", async () => {
			await createUpload("file-pending-1");
			await createOutboxEntry("file-pending-1", "pending");

			await getUploadsController(mockReq as never, mockRes as never);

			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					uploads: expect.arrayContaining([
						expect.objectContaining({
							fileId: "file-pending-1",
							parseStatus: "pending",
						}),
					]),
				}),
			);
		});

		it("should return parseStatus 'pending' for uploads with no outbox entry", async () => {
			await createUpload("file-no-outbox-1");

			await getUploadsController(mockReq as never, mockRes as never);

			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					uploads: expect.arrayContaining([
						expect.objectContaining({
							fileId: "file-no-outbox-1",
							parseStatus: "pending",
						}),
					]),
				}),
			);
		});

		it("should use latest outbox status when multiple entries exist", async () => {
			await createUpload("file-multi-status-1");
			// Create entries in order: pending -> processing -> completed
			await createOutboxEntry("file-multi-status-1", "pending");
			await createOutboxEntry("file-multi-status-1", "processing");
			await createOutboxEntry("file-multi-status-1", "completed");

			await getUploadsController(mockReq as never, mockRes as never);

			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					uploads: expect.arrayContaining([
						expect.objectContaining({
							fileId: "file-multi-status-1",
							parseStatus: "completed",
						}),
					]),
				}),
			);
		});

		it("should return correct parseStatus for multiple uploads", async () => {
			await createUpload("file-mix-1");
			await createUpload("file-mix-2");
			await createUpload("file-mix-3");
			await createOutboxEntry("file-mix-1", "completed");
			await createOutboxEntry("file-mix-2", "processing");
			// file-mix-3 has no outbox entry

			await getUploadsController(mockReq as never, mockRes as never);

			const response = jsonMock.mock.calls[0][0];
			const uploads = response.uploads;

			const file1 = uploads.find(
				(u: { fileId: string }) => u.fileId === "file-mix-1",
			);
			const file2 = uploads.find(
				(u: { fileId: string }) => u.fileId === "file-mix-2",
			);
			const file3 = uploads.find(
				(u: { fileId: string }) => u.fileId === "file-mix-3",
			);

			expect(file1?.parseStatus).toBe("completed");
			expect(file2?.parseStatus).toBe("processing");
			expect(file3?.parseStatus).toBe("pending");
		});
	});

	describe("filtering", () => {
		it("should return uploaded, deduplicated, and pending files but not failed", async () => {
			await createUpload("file-uploaded", "uploaded");
			await createUpload("file-dedup", "deduplicated");
			await createUpload("file-pending", "pending");
			await createUpload("file-failed", "failed");

			await getUploadsController(mockReq as never, mockRes as never);

			const response = jsonMock.mock.calls[0][0];
			const fileIds = response.uploads.map((u: { fileId: string }) => u.fileId);

			expect(fileIds).toContain("file-uploaded");
			expect(fileIds).toContain("file-dedup");
			expect(fileIds).toContain("file-pending");
			expect(fileIds).not.toContain("file-failed");
		});
	});

	describe("error handling", () => {
		it("should throw Unauthorized when user is missing", async () => {
			mockReq.user = undefined;

			await expect(
				getUploadsController(mockReq as never, mockRes as never),
			).rejects.toThrow("Missing authenticated user");
		});
	});

	describe("isCanonical field", () => {
		it("should return isCanonical true for canonical uploads", async () => {
			const upload = await createUpload("file-canonical-1");
			upload.isCanonical = true;
			await upload.save();

			await getUploadsController(mockReq as never, mockRes as never);

			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					uploads: expect.arrayContaining([
						expect.objectContaining({
							fileId: "file-canonical-1",
							isCanonical: true,
						}),
					]),
				}),
			);
		});

		it("should return isCanonical false for non-canonical uploads", async () => {
			const upload = await createUpload("file-non-canonical-1");
			upload.isCanonical = false;
			await upload.save();

			await getUploadsController(mockReq as never, mockRes as never);

			expect(jsonMock).toHaveBeenCalledWith(
				expect.objectContaining({
					uploads: expect.arrayContaining([
						expect.objectContaining({
							fileId: "file-non-canonical-1",
							isCanonical: false,
						}),
					]),
				}),
			);
		});
	});
});
