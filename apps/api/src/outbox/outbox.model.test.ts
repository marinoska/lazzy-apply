import type { FileUploadContentType } from "@lazyapply/types";
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { OutboxModel } from "@/outbox/outbox.model.js";

const objectId = () => new mongoose.Types.ObjectId();

describe("Outbox Model", () => {
	describe("File Type Field", () => {
		it("should accept PDF file type", async () => {
			const outbox = await OutboxModel.create({
				processId: "test-process-1",
				type: "file_upload",
				uploadId: objectId(),
				// uploadId: "upload-1",
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
				uploadId: objectId(),
				// uploadId: "upload-2",
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
					uploadId: objectId(),
					// uploadId: "upload-3",
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
					uploadId: objectId(),
					// uploadId: "upload-4",
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
				uploadId: objectId(),
				// uploadId: "upload-5",
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
				uploadId: objectId(),
				// uploadId: "upload-immutable",
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
				uploadId: objectId(),
				// uploadId: "upload-multi",
				fileId: "test-file-multi",
				userId: "test-user-multi",
				fileType: "PDF",
			});

			// Create processing entry
			await OutboxModel.create({
				processId,
				type: "file_upload",
				status: "processing",
				uploadId: objectId(),
				// uploadId: "upload-multi",
				fileId: "test-file-multi",
				userId: "test-user-multi",
				fileType: "PDF",
			});

			// Create completed entry
			await OutboxModel.create({
				processId,
				type: "file_upload",
				status: "completed",
				uploadId: objectId(),
				// uploadId: "upload-multi",
				fileId: "test-file-multi",
				userId: "test-user-multi",
				fileType: "PDF",
			});

			const entries = await OutboxModel.find({ processId }).sort({
				createdAt: 1,
			});
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
				uploadId: objectId(),
				// uploadId: "upload-failed",
				fileId: "test-file-failed",
				userId: "test-user-failed",
				fileType: "PDF",
				error: "Processing failed",
			});

			expect(failedEntry.error).toBe("Processing failed");
			expect(failedEntry.status).toBe("failed");
		});
	});

	describe("Static Methods", () => {
		describe("Convenience Methods", () => {
			it("markAsProcessing should create processing entry", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-convenience-1",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-conv-1",
					fileId: "file-conv-1",
					userId: "user-conv-1",
					fileType: "PDF",
				});

				const processing = await OutboxModel.markAsProcessing(original);

				expect(processing.processId).toBe(original.processId);
				expect(processing.status).toBe("processing");
				expect(processing.error).toBeUndefined();

				// Verify both entries exist
				const allEntries = await OutboxModel.find({
					processId: original.processId,
				});
				expect(allEntries).toHaveLength(2);
			});

			it("markAsCompleted should create completed entry", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-convenience-2",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-conv-2",
					fileId: "file-conv-2",
					userId: "user-conv-2",
					fileType: "PDF",
				});

				const completed = await OutboxModel.markAsCompleted(original);

				expect(completed.processId).toBe(original.processId);
				expect(completed.status).toBe("completed");
				expect(completed.error).toBeUndefined();

				// Verify both entries exist
				const allEntries = await OutboxModel.find({
					processId: original.processId,
				});
				expect(allEntries).toHaveLength(2);
			});

			it("markAsFailed should create failed entry with error", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-convenience-3",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-conv-3",
					fileId: "file-conv-3",
					userId: "user-conv-3",
					fileType: "PDF",
				});

				const errorMessage = "Test failure";
				const failed = await OutboxModel.markAsFailed(original, errorMessage);

				expect(failed.processId).toBe(original.processId);
				expect(failed.status).toBe("failed");
				expect(failed.error).toBe(errorMessage);

				// Verify both entries exist
				const allEntries = await OutboxModel.find({
					processId: original.processId,
				});
				expect(allEntries).toHaveLength(2);
			});
		});

		describe("createWithStatus", () => {
			it("should create new entry with processing status", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-status-1",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-status-1",
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
			});

			it("should create new entry with completed status", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-status-2",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-status-2",
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
			});

			it("should create new entry with failed status and error", async () => {
				const original = await OutboxModel.create({
					processId: "test-process-status-3",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-status-3",
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
			});
		});

		describe("findPendingLogs", () => {
			it("should return latest pending entry per processId", async () => {
				// Process 1: pending -> processing (should NOT be returned)
				await OutboxModel.create({
					processId: "process-1",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-1",
					fileId: "file-1",
					userId: "user-1",
					fileType: "PDF",
				});
				await OutboxModel.create({
					processId: "process-1",
					type: "file_upload",
					status: "processing",
					uploadId: objectId(),
					// uploadId: "upload-1",
					fileId: "file-1",
					userId: "user-1",
					fileType: "PDF",
				});

				// Process 2: pending only (should be returned)
				await OutboxModel.create({
					processId: "process-2",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-2",
					fileId: "file-2",
					userId: "user-2",
					fileType: "DOCX",
				});

				// Process 3: pending -> failed (should NOT be returned)
				await OutboxModel.create({
					processId: "process-3",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-3",
					fileId: "file-3",
					userId: "user-3",
					fileType: "PDF",
				});
				await OutboxModel.create({
					processId: "process-3",
					type: "file_upload",
					status: "failed",
					uploadId: objectId(),
					// uploadId: "upload-3",
					fileId: "file-3",
					userId: "user-3",
					fileType: "PDF",
					error: "Test error",
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
						uploadId: objectId(),
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
				await OutboxModel.create({
					processId: "process-order-1",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-order-1",
					fileId: "file-order-1",
					userId: "user-order-1",
					fileType: "PDF",
				});

				await new Promise((resolve) => setTimeout(resolve, 10));

				await OutboxModel.create({
					processId: "process-order-2",
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-order-2",
					fileId: "file-order-2",
					userId: "user-order-2",
					fileType: "PDF",
				});

				const pending = await OutboxModel.findPendingLogs(10);

				const idx1 = pending.findIndex(
					(p) => p.processId === "process-order-1",
				);
				const idx2 = pending.findIndex(
					(p) => p.processId === "process-order-2",
				);

				expect(idx1).toBeLessThan(idx2);
			});
		});

		describe("markAsSending", () => {
			it("should find pending entry and create new sending entry", async () => {
				const processId = "test-mark-sending-1";

				await OutboxModel.create({
					processId,
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-sending-1",
					fileId: "file-sending-1",
					userId: "user-sending-1",
					fileType: "PDF",
				});

				const sendingEntry = await OutboxModel.markAsSending(processId);

				expect(sendingEntry).not.toBeNull();
				expect(sendingEntry?.status).toBe("sending");
				expect(sendingEntry?.processId).toBe(processId);

				// Verify both entries exist (event-sourcing)
				const allEntries = await OutboxModel.find({ processId });
				expect(allEntries).toHaveLength(2);
				expect(allEntries.map((e) => e.status).sort()).toEqual([
					"pending",
					"sending",
				]);
			});

			it("should return null if no pending entry exists", async () => {
				const result = await OutboxModel.markAsSending("non-existent-process");
				expect(result).toBeNull();
			});

			it("should return null if entry is already processing", async () => {
				const processId = "test-mark-sending-2";

				// Create pending then processing (simulating already locked)
				await OutboxModel.create({
					processId,
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-sending-2",
					fileId: "file-sending-2",
					userId: "user-sending-2",
					fileType: "PDF",
				});
				await OutboxModel.create({
					processId,
					type: "file_upload",
					status: "processing",
					uploadId: objectId(),
					// uploadId: "upload-sending-2",
					fileId: "file-sending-2",
					userId: "user-sending-2",
					fileType: "PDF",
				});

				// findPendingLogs should not return this process
				const pending = await OutboxModel.findPendingLogs(10);
				expect(pending.find((p) => p.processId === processId)).toBeUndefined();
			});
		});

		describe("findByProcessId", () => {
			it("should return all entries for a processId sorted by createdAt desc", async () => {
				const processId = "test-process-find";

				await OutboxModel.create({
					processId,
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-find",
					fileId: "file-find",
					userId: "user-find",
					fileType: "PDF",
				});

				await new Promise((resolve) => setTimeout(resolve, 10));

				await OutboxModel.create({
					processId,
					type: "file_upload",
					status: "processing",
					uploadId: objectId(),
					// uploadId: "upload-find",
					fileId: "file-find",
					userId: "user-find",
					fileType: "PDF",
				});

				await new Promise((resolve) => setTimeout(resolve, 10));

				await OutboxModel.create({
					processId,
					type: "file_upload",
					status: "completed",
					uploadId: objectId(),
					// uploadId: "upload-find",
					fileId: "file-find",
					userId: "user-find",
					fileType: "PDF",
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

	describe("Event-Sourcing Pattern", () => {
		it("should block findOneAndUpdate", async () => {
			await OutboxModel.create({
				processId: "test-block-update-1",
				type: "file_upload",
				status: "pending",
				uploadId: objectId(),
				// uploadId: "upload-block-1",
				fileId: "file-block-1",
				userId: "user-block-1",
				fileType: "PDF",
			});

			await expect(
				OutboxModel.findOneAndUpdate(
					{ processId: "test-block-update-1" },
					{ $set: { status: "processing" } },
				),
			).rejects.toThrow("Updates not allowed on immutable outbox collection");
		});

		it("should block updateOne", async () => {
			await OutboxModel.create({
				processId: "test-block-update-2",
				type: "file_upload",
				status: "pending",
				uploadId: objectId(),
				// uploadId: "upload-block-2",
				fileId: "file-block-2",
				userId: "user-block-2",
				fileType: "PDF",
			});

			await expect(
				OutboxModel.updateOne(
					{ processId: "test-block-update-2" },
					{ $set: { status: "processing" } },
				),
			).rejects.toThrow("Updates not allowed on immutable outbox collection");
		});

		it("should block updateMany", async () => {
			await expect(
				OutboxModel.updateMany(
					{ status: "pending" },
					{ $set: { status: "failed" } },
				),
			).rejects.toThrow("Updates not allowed on immutable outbox collection");
		});

		it("should prevent duplicate status entries via unique index", async () => {
			const processId = "test-unique-index";
			const fileId = "file-unique-index";

			// Create first pending entry
			await OutboxModel.create({
				processId,
				type: "file_upload",
				status: "pending",
				uploadId: objectId(),
				// uploadId: "upload-unique",
				fileId,
				userId: "user-unique",
				fileType: "PDF",
			});

			// Attempt to create duplicate pending entry should fail
			await expect(
				OutboxModel.create({
					processId,
					type: "file_upload",
					status: "pending",
					uploadId: objectId(),
					// uploadId: "upload-unique",
					fileId,
					userId: "user-unique",
					fileType: "PDF",
				}),
			).rejects.toThrow(/duplicate key/i);
		});

		it("should allow different statuses for same fileId+processId", async () => {
			const processId = "test-multi-status";
			const fileId = "file-multi-status";

			// Create entries with different statuses - should all succeed
			await OutboxModel.create({
				processId,
				type: "file_upload",
				status: "pending",
				uploadId: objectId(),
				// uploadId: "upload-multi",
				fileId,
				userId: "user-multi",
				fileType: "PDF",
			});

			await OutboxModel.create({
				processId,
				type: "file_upload",
				status: "sending",
				uploadId: objectId(),
				// uploadId: "upload-multi",
				fileId,
				userId: "user-multi",
				fileType: "PDF",
			});

			await OutboxModel.create({
				processId,
				type: "file_upload",
				status: "processing",
				uploadId: objectId(),
				// uploadId: "upload-multi",
				fileId,
				userId: "user-multi",
				fileType: "PDF",
			});

			await OutboxModel.create({
				processId,
				type: "file_upload",
				status: "completed",
				uploadId: objectId(),
				// uploadId: "upload-multi",
				fileId,
				userId: "user-multi",
				fileType: "PDF",
			});

			const entries = await OutboxModel.find({ processId });
			expect(entries).toHaveLength(4);
		});

		it("should complete full event-sourcing flow using static methods", async () => {
			const processId = "test-full-flow";

			// Step 1: Create initial pending entry
			const pending = await OutboxModel.createOutbox({
				processId,
				type: "file_upload",
				uploadId: objectId(),
				// uploadId: "upload-flow",
				fileId: "file-flow",
				userId: "user-flow",
				fileType: "PDF",
			});
			expect(pending.status).toBe("pending");

			// Step 2: Mark as sending
			const sending = await OutboxModel.markAsSending(processId);
			expect(sending).not.toBeNull();
			expect(sending?.status).toBe("sending");

			// Step 3: Mark as processing
			if (!sending) throw new Error("Expected sending entry");
			const processing = await OutboxModel.markAsProcessing(sending);
			expect(processing.status).toBe("processing");

			// Step 4: Mark as completed
			const completed = await OutboxModel.markAsCompleted(processing);
			expect(completed.status).toBe("completed");

			// Verify full audit trail
			const allEntries = await OutboxModel.findByProcessId(processId);
			expect(allEntries).toHaveLength(4);
			expect(allEntries.map((e) => e.status).sort()).toEqual([
				"completed",
				"pending",
				"processing",
				"sending",
			]);
		});

		it("should preserve all fields across status transitions", async () => {
			const processId = "test-preserve-fields";
			const uploadId = objectId();
			const fileId = "file-preserve";
			const userId = "user-preserve";
			const fileType = "PDF";

			await OutboxModel.createOutbox({
				processId,
				type: "file_upload",
				uploadId,
				fileId,
				userId,
				fileType,
			});

			const sending = await OutboxModel.markAsSending(processId);
			if (!sending) throw new Error("Expected sending entry");
			const processing = await OutboxModel.markAsProcessing(sending);
			await OutboxModel.markAsCompleted(processing);

			// All entries should have same immutable fields
			const allEntries = await OutboxModel.find({ processId });
			for (const entry of allEntries) {
				expect(entry.processId).toBe(processId);
				expect(entry.uploadId.toString()).toBe(uploadId.toString());
				expect(entry.fileId).toBe(fileId);
				expect(entry.userId).toBe(userId);
				expect(entry.fileType).toBe(fileType);
				expect(entry.type).toBe("file_upload");
			}
		});
	});
});
