import { describe, it, expect, beforeEach } from "vitest";
import { OutboxModel } from "@/outbox/outbox.model.js";
import type { FileUploadContentType } from "@lazyapply/types";

describe("Outbox Model", () => {
	describe("File Type Field", () => {
		it("should accept PDF file type", async () => {
			const outbox = await OutboxModel.create({
				logId: "test-log-1",
				type: "file_upload",
				status: "pending",
				uploadId: "upload-1",
				fileId: "test-file-1",
				userId: "test-user-1",
				fileType: "PDF" as FileUploadContentType,
			});

			expect(outbox.fileType).toBe("PDF");
		});

		it("should accept DOCX file type", async () => {
			const outbox = await OutboxModel.create({
				logId: "test-log-2",
				type: "file_upload",
				status: "pending",
				uploadId: "upload-2",
				fileId: "test-file-2",
				userId: "test-user-2",
				fileType: "DOCX" as FileUploadContentType,
			});

			expect(outbox.fileType).toBe("DOCX");
		});

		it("should reject lowercase file types", async () => {
			await expect(
				OutboxModel.create({
					logId: "test-log-3",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-3",
					fileId: "test-file-3",
					userId: "test-user-3",
					fileType: "pdf",
				}),
			).rejects.toThrow();
		});

		it("should reject invalid file types", async () => {
			await expect(
				OutboxModel.create({
					logId: "test-log-4",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-4",
					fileId: "test-file-4",
					userId: "test-user-4",
					fileType: "TXT",
				}),
			).rejects.toThrow();
		});

		it("should be immutable", async () => {
			const outbox = await OutboxModel.create({
				logId: "test-log-5",
				type: "file_upload",
				status: "pending",
				uploadId: "upload-5",
				fileId: "test-file-5",
				userId: "test-user-5",
				fileType: "PDF",
			});

			outbox.fileType = "DOCX";
			await outbox.save();

			const reloaded = await OutboxModel.findOne({ logId: "test-log-5" });
			expect(reloaded?.fileType).toBe("PDF");
		});
	});

	describe("Outbox Methods", () => {
		let outbox: any;

		beforeEach(async () => {
			outbox = await OutboxModel.create({
				logId: "test-log-methods",
				type: "file_upload",
				status: "pending",
				uploadId: "upload-methods",
				fileId: "test-file-methods",
				userId: "test-user-methods",
				fileType: "PDF",
			});
		});

		it("should mark as processing", async () => {
			await outbox.markAsProcessing();
			expect(outbox.status).toBe("processing");
		});

		it("should mark as completed", async () => {
			await outbox.markAsCompleted();
			expect(outbox.status).toBe("completed");
			expect(outbox.processedAt).toBeDefined();
		});

		it("should mark as failed with error", async () => {
			const errorMessage = "Test error";
			await outbox.markAsFailed(errorMessage);
			expect(outbox.status).toBe("failed");
			expect(outbox.error).toBe(errorMessage);
			expect(outbox.processedAt).toBeDefined();
		});

		it("should not allow changing from completed to failed", async () => {
			await outbox.markAsCompleted();
			expect(outbox.status).toBe("completed");

			await expect(outbox.markAsFailed("Error after completion")).rejects.toThrow(
				"Cannot change status from completed to failed",
			);
		});

		it("should not allow changing from failed to completed", async () => {
			await outbox.markAsFailed("Initial error");
			expect(outbox.status).toBe("failed");

			await expect(outbox.markAsCompleted()).rejects.toThrow(
				"Cannot change status from failed to completed",
			);
		});

		it("should not allow changing from completed to processing", async () => {
			await outbox.markAsCompleted();
			expect(outbox.status).toBe("completed");

			await expect(outbox.markAsProcessing()).rejects.toThrow(
				"Cannot change status from completed to processing",
			);
		});
	});
});
