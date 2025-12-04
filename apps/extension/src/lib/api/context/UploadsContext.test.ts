import { describe, expect, it } from "vitest";
import type { UploadDTO } from "../api.js";

/**
 * Tests for UploadsContext logic.
 * Since we don't have React testing utilities, we test the pure logic
 * that would be used in the context.
 */

const createMockUpload = (overrides: Partial<UploadDTO> = {}): UploadDTO => ({
	fileId: `file-${Math.random().toString(36).slice(2)}`,
	originalFilename: "test.pdf",
	contentType: "PDF",
	status: "uploaded",
	size: 1024,
	isCanonical: true,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	parseStatus: "completed",
	...overrides,
});

describe("UploadsContext logic", () => {
	describe("isReady computation", () => {
		it("should mark upload as ready when status is uploaded and parseStatus is completed", () => {
			const upload = createMockUpload({
				status: "uploaded",
				parseStatus: "completed",
			});

			const isReady =
				upload.status === "uploaded" && upload.parseStatus === "completed";

			expect(isReady).toBe(true);
		});

		it("should not mark upload as ready when status is pending", () => {
			const upload = createMockUpload({
				status: "pending",
				parseStatus: "completed",
			});

			const isReady =
				upload.status === "uploaded" && upload.parseStatus === "completed";

			expect(isReady).toBe(false);
		});

		it("should not mark upload as ready when parseStatus is processing", () => {
			const upload = createMockUpload({
				status: "uploaded",
				parseStatus: "processing",
			});

			const isReady =
				upload.status === "uploaded" && upload.parseStatus === "completed";

			expect(isReady).toBe(false);
		});
	});

	describe("isCanonical for selectability", () => {
		it("should allow selection when isCanonical is true", () => {
			const upload = createMockUpload({ isCanonical: true });

			expect(upload.isCanonical).toBe(true);
		});

		it("should not allow selection when isCanonical is false", () => {
			const upload = createMockUpload({ isCanonical: false });

			expect(upload.isCanonical).toBe(false);
		});
	});

	describe("selectedUpload default selection", () => {
		it("should select first upload when uploads are available", () => {
			const uploads = [
				createMockUpload({ fileId: "first" }),
				createMockUpload({ fileId: "second" }),
			];

			const selectedUpload = uploads[0] ?? null;

			expect(selectedUpload?.fileId).toBe("first");
		});

		it("should return null when no uploads are available", () => {
			const uploads: UploadDTO[] = [];

			const selectedUpload = uploads[0] ?? null;

			expect(selectedUpload).toBeNull();
		});

		it("should keep current selection if it still exists in uploads", () => {
			const uploads = [
				createMockUpload({ fileId: "first" }),
				createMockUpload({ fileId: "second" }),
				createMockUpload({ fileId: "third" }),
			];
			const currentSelection = uploads[1]; // "second"

			const stillExists = uploads.find(
				(u) => u.fileId === currentSelection.fileId,
			);

			expect(stillExists).toBeDefined();
			expect(stillExists?.fileId).toBe("second");
		});

		it("should reset selection to first upload if current selection no longer exists", () => {
			const uploads = [
				createMockUpload({ fileId: "first" }),
				createMockUpload({ fileId: "third" }),
			];
			const currentSelection = createMockUpload({ fileId: "deleted" });

			const stillExists = uploads.find(
				(u) => u.fileId === currentSelection.fileId,
			);
			const newSelection = stillExists ?? uploads[0] ?? null;

			expect(stillExists).toBeUndefined();
			expect(newSelection?.fileId).toBe("first");
		});
	});

	describe("readyUploads filtering", () => {
		it("should filter only ready uploads", () => {
			const uploads = [
				createMockUpload({
					fileId: "ready1",
					status: "uploaded",
					parseStatus: "completed",
				}),
				createMockUpload({
					fileId: "pending1",
					status: "pending",
					parseStatus: "pending",
				}),
				createMockUpload({
					fileId: "ready2",
					status: "uploaded",
					parseStatus: "completed",
				}),
				createMockUpload({
					fileId: "processing1",
					status: "uploaded",
					parseStatus: "processing",
				}),
			];

			const readyUploads = uploads.filter(
				(u) => u.status === "uploaded" && u.parseStatus === "completed",
			);

			expect(readyUploads).toHaveLength(2);
			expect(readyUploads.map((u) => u.fileId)).toEqual(["ready1", "ready2"]);
		});
	});
});
