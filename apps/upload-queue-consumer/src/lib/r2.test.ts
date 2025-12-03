import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env } from "../types";
import { deleteFile, downloadFile } from "./r2";

describe("r2", () => {
	let mockEnv: Env;
	let mockBucket: R2Bucket;

	beforeEach(() => {
		mockBucket = {
			get: vi.fn(),
			delete: vi.fn(),
			put: vi.fn(),
			head: vi.fn(),
			list: vi.fn(),
			createMultipartUpload: vi.fn(),
			resumeMultipartUpload: vi.fn(),
		} as unknown as R2Bucket;

		mockEnv = {
			UPLOADS_BUCKET: mockBucket,
			PARSE_CV_DLQ: {} as Queue,
			API_URL: "http://test-api.com",
			WORKER_SECRET: "test-secret",
			EXTENSION_SECRET: "test-extension-secret",
			OPENAI_API_KEY: "test-openai-key",
			AI_MODEL_NAME: "gpt-4o-mini",
			AI_MODEL_INPUT_PRICE_PER_1M: "0.15",
			AI_MODEL_OUTPUT_PRICE_PER_1M: "0.60",
			ENVIRONMENT: "local",
			AXIOM_API_TOKEN: "test-axiom-token",
			AXIOM_OTEL_DATASET: "test-otel-dataset",
			AXIOM_LOGS_DATASET: "test-logs-dataset",
		};
	});

	describe("downloadFile", () => {
		it("should successfully download a file", async () => {
			const mockArrayBuffer = new ArrayBuffer(100);
			const mockObject = {
				arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
			};

			vi.mocked(mockBucket.get).mockResolvedValue(
				mockObject as unknown as R2ObjectBody,
			);

			const result = await downloadFile(mockEnv, "test-file-id");

			expect(mockBucket.get).toHaveBeenCalledWith("cv/test-file-id");
			expect(result).toBe(mockArrayBuffer);
		});

		it("should return null when file is not found", async () => {
			vi.mocked(mockBucket.get).mockResolvedValue(null);

			const result = await downloadFile(mockEnv, "non-existent-file");

			expect(mockBucket.get).toHaveBeenCalledWith("cv/non-existent-file");
			expect(result).toBeNull();
		});

		it("should throw error when download fails", async () => {
			const error = new Error("R2 connection failed");
			vi.mocked(mockBucket.get).mockRejectedValue(error);

			await expect(downloadFile(mockEnv, "test-file-id")).rejects.toThrow(
				"R2 connection failed",
			);
		});

		it("should use correct object key format", async () => {
			const mockObject = {
				arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(50)),
			};
			vi.mocked(mockBucket.get).mockResolvedValue(
				mockObject as unknown as R2ObjectBody,
			);

			await downloadFile(mockEnv, "my-file-123");

			expect(mockBucket.get).toHaveBeenCalledWith("cv/my-file-123");
		});
	});

	describe("deleteFile", () => {
		it("should successfully delete a file", async () => {
			vi.mocked(mockBucket.delete).mockResolvedValue(undefined);

			await deleteFile(mockEnv, "test-file-id");

			expect(mockBucket.delete).toHaveBeenCalledWith("cv/test-file-id");
		});

		it("should throw error when delete fails", async () => {
			const error = new Error("R2 delete failed");
			vi.mocked(mockBucket.delete).mockRejectedValue(error);

			await expect(deleteFile(mockEnv, "test-file-id")).rejects.toThrow(
				"R2 delete failed",
			);
		});

		it("should use correct object key format", async () => {
			vi.mocked(mockBucket.delete).mockResolvedValue(undefined);

			await deleteFile(mockEnv, "file-to-delete");

			expect(mockBucket.delete).toHaveBeenCalledWith("cv/file-to-delete");
		});

		it("should handle multiple delete operations", async () => {
			vi.mocked(mockBucket.delete).mockResolvedValue(undefined);

			await deleteFile(mockEnv, "file-1");
			await deleteFile(mockEnv, "file-2");
			await deleteFile(mockEnv, "file-3");

			expect(mockBucket.delete).toHaveBeenCalledTimes(3);
			expect(mockBucket.delete).toHaveBeenNthCalledWith(1, "cv/file-1");
			expect(mockBucket.delete).toHaveBeenNthCalledWith(2, "cv/file-2");
			expect(mockBucket.delete).toHaveBeenNthCalledWith(3, "cv/file-3");
		});
	});
});
