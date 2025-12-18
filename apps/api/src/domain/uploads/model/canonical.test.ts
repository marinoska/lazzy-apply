import type { FileUploadContentType } from "@lazyapply/types";
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { FileUploadModel } from "./fileUpload.model.js";
import {
	BLOCKING_STATUSES,
	isBlockingStatus,
	isReplaceableStatus,
	REPLACEABLE_STATUSES,
} from "./fileUpload.statics.js";

// Helper to run resolveAndClaimCanonical within a transaction
const resolveWithSession = async (params: {
	fileHash: string;
	excludeFileId: string;
	userId: string;
}) => {
	const session = await mongoose.startSession();
	session.startTransaction();
	try {
		const result = await FileUploadModel.resolveAndClaimCanonical(
			params,
			session,
		);
		await session.commitTransaction();
		return result;
	} catch (error) {
		await session.abortTransaction();
		throw error;
	} finally {
		session.endSession();
	}
};

const createUpload = async (
	overrides: Partial<{
		fileId: string;
		fileHash: string;
		userId: string;
		status: string;
		isCanonical: boolean;
	}> = {},
) => {
	const fileId = overrides.fileId ?? `file-${Date.now()}-${Math.random()}`;
	return FileUploadModel.create({
		fileId,
		objectKey: `cv/${fileId}`,
		originalFilename: "test.pdf",
		contentType: "PDF" as FileUploadContentType,
		directory: "cv",
		bucket: "test-bucket",
		userId: overrides.userId ?? "test-user",
		status: overrides.status ?? "uploaded",
		fileHash: overrides.fileHash ?? `hash-${fileId}`,
		isCanonical: overrides.isCanonical ?? false,
		rawText: "Test raw text",
		size: 1000,
	});
};

describe("Canonical Upload", () => {
	describe("Status Constants", () => {
		it("should have correct replaceable statuses", () => {
			expect(REPLACEABLE_STATUSES).toContain("failed");
			expect(REPLACEABLE_STATUSES).toContain("rejected");
			expect(REPLACEABLE_STATUSES).toContain("deleted-by-user");
			expect(REPLACEABLE_STATUSES).toHaveLength(3);
		});

		it("should have correct blocking statuses", () => {
			expect(BLOCKING_STATUSES).toContain("pending");
			expect(BLOCKING_STATUSES).toContain("uploaded");
			// deduplicated is not a blocking status - it can never be canonical
			expect(BLOCKING_STATUSES).toHaveLength(2);
		});
	});

	describe("isReplaceableStatus", () => {
		it("should return true for replaceable statuses", () => {
			expect(isReplaceableStatus("failed")).toBe(true);
			expect(isReplaceableStatus("rejected")).toBe(true);
			expect(isReplaceableStatus("deleted-by-user")).toBe(true);
		});

		it("should return false for blocking statuses", () => {
			expect(isReplaceableStatus("pending")).toBe(false);
			expect(isReplaceableStatus("uploaded")).toBe(false);
			expect(isReplaceableStatus("deduplicated")).toBe(false);
		});
	});

	describe("isBlockingStatus", () => {
		it("should return true for blocking statuses", () => {
			expect(isBlockingStatus("pending")).toBe(true);
			expect(isBlockingStatus("uploaded")).toBe(true);
		});

		it("should return false for replaceable statuses", () => {
			expect(isBlockingStatus("failed")).toBe(false);
			expect(isBlockingStatus("rejected")).toBe(false);
			expect(isBlockingStatus("deleted-by-user")).toBe(false);
		});

		it("should return false for deduplicated (cannot be canonical)", () => {
			expect(isBlockingStatus("deduplicated")).toBe(false);
		});
	});

	describe("FileUploadModel.findCanonical", () => {
		it("should return null when no canonical exists", async () => {
			const result = await FileUploadModel.findCanonical({
				fileHash: "non-existent-hash",
				userId: "test-user",
			});
			expect(result).toBeNull();
		});

		it("should find canonical upload by fileHash", async () => {
			const fileHash = `hash-find-canonical-${Date.now()}`;
			await createUpload({
				fileId: "canonical-upload",
				fileHash,
				userId: "test-user",
				isCanonical: true,
			});

			const result = await FileUploadModel.findCanonical({
				fileHash,
				userId: "test-user",
			});
			expect(result).not.toBeNull();
			expect(result?.fileHash).toBe(fileHash);
			expect(result?.isCanonical).toBe(true);
		});

		it("should not find non-canonical upload", async () => {
			const fileHash = `hash-non-canonical-${Date.now()}`;
			await createUpload({
				fileId: "non-canonical-upload",
				fileHash,
				userId: "test-user",
				isCanonical: false,
			});

			const result = await FileUploadModel.findCanonical({
				fileHash,
				userId: "test-user",
			});
			expect(result).toBeNull();
		});
	});

	describe("resolveAndClaimCanonical", () => {
		describe("No existing canonical", () => {
			it("should return become_canonical when no canonical exists", async () => {
				const result = await resolveWithSession({
					fileHash: `new-hash-${Date.now()}`,
					excludeFileId: "new-file",
					userId: "test-user",
				});

				expect(result.action).toBe("become_canonical");
				if (result.action === "become_canonical") {
					expect(result.previousCanonical).toBeUndefined();
				}
			});
		});

		describe("Existing canonical with blocking status", () => {
			it("should deduplicate against canonical with status=uploaded", async () => {
				const fileHash = `hash-uploaded-${Date.now()}`;
				const canonical = await createUpload({
					fileId: "canonical-uploaded",
					fileHash,
					userId: "test-user",
					status: "uploaded",
					isCanonical: true,
				});

				const result = await resolveWithSession({
					fileHash,
					excludeFileId: "new-file",
					userId: "test-user",
				});

				expect(result.action).toBe("deduplicate");
				if (result.action === "deduplicate") {
					expect(result.canonicalUpload.fileId).toBe(canonical.fileId);
				}
			});

			// Note: deduplicated uploads cannot be canonical (enforced by schema validator)
			// A deduplicated upload always points to another canonical upload

			it("should deduplicate against canonical with status=pending", async () => {
				const fileHash = `hash-pending-${Date.now()}`;
				await createUpload({
					fileId: "canonical-pending",
					fileHash,
					userId: "test-user",
					status: "pending",
					isCanonical: true,
				});

				const result = await resolveWithSession({
					fileHash,
					excludeFileId: "new-file",
					userId: "test-user",
				});

				expect(result.action).toBe("deduplicate");
			});
		});

		describe("Existing canonical with replaceable status", () => {
			it("should replace canonical with status=failed and revoke old canonical", async () => {
				const fileHash = `hash-failed-${Date.now()}`;
				const oldCanonical = await createUpload({
					fileId: "canonical-failed",
					fileHash,
					userId: "test-user",
					status: "failed",
					isCanonical: true,
				});

				const result = await resolveWithSession({
					fileHash,
					excludeFileId: "new-file",
					userId: "test-user",
				});

				expect(result.action).toBe("become_canonical");
				if (result.action === "become_canonical") {
					expect(result.previousCanonical?.fileId).toBe(oldCanonical.fileId);
				}

				// Verify old canonical was revoked
				const updatedOld = await FileUploadModel.findOne({
					fileId: oldCanonical.fileId,
				}).setOptions({ userId: "test-user" });
				expect(updatedOld?.isCanonical).toBe(false);
			});

			it("should replace canonical with status=rejected", async () => {
				const fileHash = `hash-rejected-${Date.now()}`;
				const oldCanonical = await createUpload({
					fileId: "canonical-rejected",
					fileHash,
					userId: "test-user",
					status: "rejected",
					isCanonical: true,
				});

				const result = await resolveWithSession({
					fileHash,
					excludeFileId: "new-file",
					userId: "test-user",
				});

				expect(result.action).toBe("become_canonical");
				if (result.action === "become_canonical") {
					expect(result.previousCanonical?.fileId).toBe(oldCanonical.fileId);
				}
			});

			it("should replace canonical with status=deleted-by-user", async () => {
				const fileHash = `hash-deleted-${Date.now()}`;
				const oldCanonical = await createUpload({
					fileId: "canonical-deleted",
					fileHash,
					userId: "test-user",
					status: "deleted-by-user",
					isCanonical: true,
				});

				const result = await resolveWithSession({
					fileHash,
					excludeFileId: "new-file",
					userId: "test-user",
				});

				expect(result.action).toBe("become_canonical");
				if (result.action === "become_canonical") {
					expect(result.previousCanonical?.fileId).toBe(oldCanonical.fileId);
				}
			});
		});

		describe("Edge cases", () => {
			it("should handle same fileId lookup gracefully", async () => {
				const fileHash = `hash-same-${Date.now()}`;
				const upload = await createUpload({
					fileId: "same-file",
					fileHash,
					userId: "test-user",
					status: "uploaded",
					isCanonical: true,
				});

				const result = await resolveWithSession({
					fileHash,
					excludeFileId: upload.fileId,
					userId: "test-user",
				});

				// Should treat as become_canonical since it's the same file
				expect(result.action).toBe("become_canonical");
			});
		});
	});
});

describe("Canonical Upload Uniqueness", () => {
	it("should enforce unique canonical per fileHash via index", async () => {
		const fileHash = `unique-hash-${Date.now()}`;

		// Create first canonical
		await createUpload({
			fileId: "first-canonical",
			fileHash,
			userId: "test-user",
			isCanonical: true,
		});

		// Attempt to create second canonical with same hash should fail
		await expect(
			createUpload({
				fileId: "second-canonical",
				fileHash,
				userId: "test-user",
				isCanonical: true,
			}),
		).rejects.toThrow(/duplicate key/i);
	});

	it("should allow multiple non-canonical uploads with same fileHash", async () => {
		const fileHash = `multi-non-canonical-${Date.now()}`;

		const first = await createUpload({
			fileId: "first-non-canonical",
			fileHash,
			userId: "test-user",
			isCanonical: false,
		});

		const second = await createUpload({
			fileId: "second-non-canonical",
			fileHash,
			userId: "test-user",
			isCanonical: false,
		});

		expect(first.fileHash).toBe(fileHash);
		expect(second.fileHash).toBe(fileHash);
		expect(first.isCanonical).toBe(false);
		expect(second.isCanonical).toBe(false);
	});
});

describe("Deduplicated Cannot Be Canonical Constraint", () => {
	it("should reject creating deduplicated upload with isCanonical=true", async () => {
		await expect(
			createUpload({
				fileId: `dedup-canonical-${Date.now()}`,
				userId: "test-user",
				status: "deduplicated",
				isCanonical: true,
			}),
		).rejects.toThrow("Deduplicated uploads cannot be canonical");
	});

	it("should allow deduplicated upload with isCanonical=false", async () => {
		const upload = await createUpload({
			fileId: `dedup-non-canonical-${Date.now()}`,
			userId: "test-user",
			status: "deduplicated",
			isCanonical: false,
		});

		expect(upload.status).toBe("deduplicated");
		expect(upload.isCanonical).toBe(false);
	});
});
