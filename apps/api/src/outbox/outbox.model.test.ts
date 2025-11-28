import { describe, it, expect, beforeEach } from "vitest";
import { OutboxModel } from "@/outbox/outbox.model.js";
import type { FileUploadContentType } from "@lazyapply/types";

describe("Outbox Model", () => {
	describe("File Type Field", () => {
		it("should accept PDF file type", async () => {
			const outbox = await OutboxModel.create({
				processId: "test-process-1",
				type: "file_upload",
				uploadId: "upload-1",
				fileId: "test-file-1",
				userId: "test-user-1",
				fileType: "PDF" as FileUploadContentType,
			});

			expect(outbox.fileType).toBe("PDF");
		});

		it("should accept DOCX file type", async () => {
			const outbox = await OutboxModel.create({
				processId: "test-process-2",
				type: "file_upload",
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
					processId: "test-process-3",
					type: "file_upload",
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
					processId: "test-process-4",
					type: "file_upload",
					uploadId: "upload-4",
					fileId: "test-file-4",
					userId: "test-user-4",
					fileType: "TXT",
				}),
			).rejects.toThrow();
		});

		it("should be immutable", async () => {
			const outbox = await OutboxModel.create({
				processId: "test-process-5",
				type: "file_upload",
				uploadId: "upload-5",
				fileId: "test-file-5",
				userId: "test-user-5",
				fileType: "PDF",
			});

			outbox.fileType = "DOCX";
			await expect(outbox.save()).rejects.toThrow(
				"Updates not allowed on immutable outbox collection",
			);
		});
	});

	describe("Immutable Outbox Pattern", () => {
		it("should prevent updates to existing documents", async () => {
			const outbox = await OutboxModel.create({
				processId: "test-process-immutable",
				type: "file_upload",
				status: "pending",
				uploadId: "upload-immutable",
				fileId: "test-file-immutable",
				userId: "test-user-immutable",
				fileType: "PDF",
			});

			// Try to update status
			outbox.status = "completed";
			await expect(outbox.save()).rejects.toThrow(
				"Updates not allowed on immutable outbox collection",
			);
		});

		it("should allow creating multiple entries with same processId", async () => {
			const processId = "test-process-multi";

			// Create initial pending entry
			await OutboxModel.create({
				processId,
				type: "file_upload",
				status: "pending",
				uploadId: "upload-multi",
				fileId: "test-file-multi",
				userId: "test-user-multi",
				fileType: "PDF",
			});

			// Create processing entry
			await OutboxModel.create({
				processId,
				type: "file_upload",
				status: "processing",
				uploadId: "upload-multi",
				fileId: "test-file-multi",
				userId: "test-user-multi",
				fileType: "PDF",
			});

			// Create completed entry
			await OutboxModel.create({
				processId,
				type: "file_upload",
				status: "completed",
				uploadId: "upload-multi",
				fileId: "test-file-multi",
				userId: "test-user-multi",
				fileType: "PDF",
				processedAt: new Date(),
			});

			const entries = await OutboxModel.find({ processId }).sort({ createdAt: 1 });
			expect(entries).toHaveLength(3);
			expect(entries[0].status).toBe("pending");
			expect(entries[1].status).toBe("processing");
			expect(entries[2].status).toBe("completed");
		});

		it("should create entry with error for failed state", async () => {
			const failedEntry = await OutboxModel.create({
				processId: "test-process-failed",
				type: "file_upload",
				status: "failed",
				uploadId: "upload-failed",
				fileId: "test-file-failed",
				userId: "test-user-failed",
				fileType: "PDF",
				error: "Processing failed",
				processedAt: new Date(),
			});

			expect(failedEntry.error).toBe("Processing failed");
			expect(failedEntry.status).toBe("failed");
			expect(failedEntry.processedAt).toBeDefined();
		});
	});

	describe("Static Methods", () => {
		describe("Convenience Methods", () => {
			it("markAsProcessing should create processing entry", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-convenience-1",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-conv-1",
					fileId: "file-conv-1",
					userId: "user-conv-1",
					fileType: "PDF",
				});

				const processing = await OutboxModel.markAsProcessing(original);

				expect(processing.processId).toBe(original.processId);
				expect(processing.status).toBe("processing");
				expect(processing.error).toBeUndefined();
				expect(processing.processedAt).toBeUndefined();

				// Verify both entries exist
				const allEntries = await OutboxModel.find({ processId: original.processId });
				expect(allEntries).toHaveLength(2);
			});

			it("markAsCompleted should create completed entry with processedAt", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-convenience-2",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-conv-2",
					fileId: "file-conv-2",
					userId: "user-conv-2",
					fileType: "PDF",
				});

				const completed = await OutboxModel.markAsCompleted(original);

				expect(completed.processId).toBe(original.processId);
				expect(completed.status).toBe("completed");
				expect(completed.error).toBeUndefined();
				expect(completed.processedAt).toBeDefined();

				// Verify both entries exist
				const allEntries = await OutboxModel.find({ processId: original.processId });
				expect(allEntries).toHaveLength(2);
			});

			it("markAsFailed should create failed entry with error and processedAt", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-convenience-3",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-conv-3",
					fileId: "file-conv-3",
					userId: "user-conv-3",
					fileType: "PDF",
				});

				const errorMessage = "Test failure";
				const failed = await OutboxModel.markAsFailed(original, errorMessage);

				expect(failed.processId).toBe(original.processId);
				expect(failed.status).toBe("failed");
				expect(failed.error).toBe(errorMessage);
				expect(failed.processedAt).toBeDefined();

				// Verify both entries exist
				const allEntries = await OutboxModel.find({ processId: original.processId });
				expect(allEntries).toHaveLength(2);
			});
		});

		describe("createWithStatus", () => {
			it("should create new entry with processing status", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-status-1",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-status-1",
					fileId: "test-file-status-1",
					userId: "test-user-status-1",
					fileType: "PDF",
				});

				const processing = await OutboxModel.createWithStatus(
					original,
					"processing",
				);

				expect(processing.processId).toBe(original.processId);
				expect(processing.status).toBe("processing");
				expect(processing.error).toBeUndefined();
				expect(processing.processedAt).toBeUndefined();
			});

			it("should create new entry with completed status and processedAt", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-status-2",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-status-2",
					fileId: "test-file-status-2",
					userId: "test-user-status-2",
					fileType: "PDF",
				});

				const completed = await OutboxModel.createWithStatus(
					original,
					"completed",
				);

				expect(completed.processId).toBe(original.processId);
				expect(completed.status).toBe("completed");
				expect(completed.error).toBeUndefined();
				expect(completed.processedAt).toBeDefined();
			});

			it("should create new entry with failed status, error, and processedAt", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-status-3",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-status-3",
					fileId: "test-file-status-3",
					userId: "test-user-status-3",
					fileType: "PDF",
				});

				const errorMessage = "File parsing failed";
				const failed = await OutboxModel.createWithStatus(
					original,
					"failed",
					errorMessage,
				);

				expect(failed.processId).toBe(original.processId);
				expect(failed.status).toBe("failed");
				expect(failed.error).toBe(errorMessage);
				expect(failed.processedAt).toBeDefined();
			});
		});

		describe("findPendingLogs", () => {
			it("should return latest pending entry per processId", async () => {
				// Process 1: pending -> processing (should NOT be returned)
				await OutboxModel.create({
					processId: "process-1",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-1",
					fileId: "file-1",
					userId: "user-1",
					fileType: "PDF",
				});
				await OutboxModel.create({
					processId: "process-1",
					type: "file_upload",
					status: "processing",
					uploadId: "upload-1",
					fileId: "file-1",
					userId: "user-1",
					fileType: "PDF",
				});

				// Process 2: pending only (should be returned)
				await OutboxModel.create({
					processId: "process-2",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-2",
					fileId: "file-2",
					userId: "user-2",
					fileType: "DOCX",
				});

				// Process 3: pending -> failed (should NOT be returned)
				await OutboxModel.create({
					processId: "process-3",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-3",
					fileId: "file-3",
					userId: "user-3",
					fileType: "PDF",
				});
				await OutboxModel.create({
					processId: "process-3",
					type: "file_upload",
					status: "failed",
					uploadId: "upload-3",
					fileId: "file-3",
					userId: "user-3",
					fileType: "PDF",
					error: "Test error",
					processedAt: new Date(),
				});

				const pending = await OutboxModel.findPendingLogs(10);

				expect(pending).toHaveLength(1);
				expect(pending[0].processId).toBe("process-2");
				expect(pending[0].status).toBe("pending");
			});

			it("should respect limit parameter", async () => {
				// Create 5 pending processes
				for (let i = 1; i <= 5; i++) {
					await OutboxModel.create({
						processId: `process-limit-${i}`,
						type: "file_upload",
						status: "pending",
						uploadId: `upload-${i}`,
						fileId: `file-${i}`,
						userId: `user-${i}`,
						fileType: "PDF",
					});
				}

				const pending = await OutboxModel.findPendingLogs(3);

				expect(pending).toHaveLength(3);
			});

			it("should return oldest pending entries first", async () => {
				// Create entries with delays to ensure different timestamps
				const process1 = await OutboxModel.create({
					processId: "process-order-1",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-order-1",
					fileId: "file-order-1",
					userId: "user-order-1",
					fileType: "PDF",
				});

				await new Promise((resolve) => setTimeout(resolve, 10));

				const process2 = await OutboxModel.create({
					processId: "process-order-2",
					type: "file_upload",
					status: "pending",
					uploadId: "upload-order-2",
					fileId: "file-order-2",
					userId: "user-order-2",
					fileType: "PDF",
				});

				const pending = await OutboxModel.findPendingLogs(10);

				const idx1 = pending.findIndex((p: any) => p.processId === "process-order-1");
				const idx2 = pending.findIndex((p: any) => p.processId === "process-order-2");

				expect(idx1).toBeLessThan(idx2);
			});
		});

		describe("findByProcessId", () => {
			it("should return all entries for a processId sorted by createdAt desc", async () => {
				const processId = "test-process-find";

				const entry1 = await OutboxModel.create({
					processId,
					type: "file_upload",
					status: "pending",
					uploadId: "upload-find",
					fileId: "file-find",
					userId: "user-find",
					fileType: "PDF",
				});

				await new Promise((resolve) => setTimeout(resolve, 10));

				const entry2 = await OutboxModel.create({
					processId,
					type: "file_upload",
					status: "processing",
					uploadId: "upload-find",
					fileId: "file-find",
					userId: "user-find",
					fileType: "PDF",
				});

				await new Promise((resolve) => setTimeout(resolve, 10));

				const entry3 = await OutboxModel.create({
					processId,
					type: "file_upload",
					status: "completed",
					uploadId: "upload-find",
					fileId: "file-find",
					userId: "user-find",
					fileType: "PDF",
					processedAt: new Date(),
				});

				const entries = await OutboxModel.findByProcessId(processId);

				expect(entries).toHaveLength(3);
				// Should be sorted newest first
				expect(entries[0].status).toBe("completed");
				expect(entries[1].status).toBe("processing");
				expect(entries[2].status).toBe("pending");
			});

			it("should return empty array for non-existent processId", async () => {
				const entries = await OutboxModel.findByProcessId("non-existent");
				expect(entries).toHaveLength(0);
			});
		});
	});
});
