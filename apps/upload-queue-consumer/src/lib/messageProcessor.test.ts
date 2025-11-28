import { describe, it, expect, vi, beforeEach } from "vitest";
import { processMessage } from "./messageProcessor";
import type { ParseCVQueueMessage } from "@lazyapply/types";
import type { Env } from "../types";

// Mock all dependencies
vi.mock("./logger", () => ({
	Logger: vi.fn().mockImplementation(() => ({
		info: vi.fn().mockResolvedValue(undefined),
		warn: vi.fn().mockResolvedValue(undefined),
		error: vi.fn().mockResolvedValue(undefined),
		flush: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock("./r2", () => ({
	downloadFile: vi.fn(),
	deleteFile: vi.fn(),
}));

vi.mock("./cvParser", () => ({
	parseCV: vi.fn(),
}));

vi.mock("./outbox", () => ({
	updateOutboxStatus: vi.fn(),
}));

vi.mock("@opentelemetry/api", () => ({
	trace: {
		getTracer: vi.fn(() => ({
			startSpan: vi.fn(() => ({
				setAttribute: vi.fn(),
				setStatus: vi.fn(),
				recordException: vi.fn(),
				end: vi.fn(),
			})),
		})),
	},
	context: {
		active: vi.fn(() => ({
			setValue: vi.fn(() => ({})),
		})),
	},
}));

import { downloadFile, deleteFile } from "./r2";
import { parseCV } from "./cvParser";
import { updateOutboxStatus } from "./outbox";

describe("messageProcessor", () => {
	let mockEnv: Env;
	let mockPayload: ParseCVQueueMessage;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEnv = {
			UPLOADS_BUCKET: {} as R2Bucket,
			PARSE_CV_DLQ: {} as Queue,
			API_URL: "http://test-api.com",
			WORKER_SECRET: "test-secret",
			OPENAI_API_KEY: "test-openai-key",
			ENVIRONMENT: "local",
			AXIOM_API_TOKEN: "test-axiom-token",
			AXIOM_OTEL_DATASET: "test-otel-dataset",
			AXIOM_LOGS_DATASET: "test-logs-dataset",
		};

		mockPayload = {
			uploadId: "upload-123",
			fileId: "file-456",
			logId: "log-789",
			userId: "user-001",
			fileType: "PDF",
		};
	});

	describe("processMessage", () => {
		it("should successfully process a valid message", async () => {
			const mockFileBuffer = new ArrayBuffer(1000);
			const mockParsedData = {
				personal: {
					fullName: "Test User",
					email: "test@example.com",
					phone: null,
					location: null,
				},
				links: [],
				summary: "Test summary",
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test CV content",
			};

			vi.mocked(downloadFile).mockResolvedValue(mockFileBuffer);
			vi.mocked(parseCV).mockResolvedValue(mockParsedData);
			vi.mocked(updateOutboxStatus).mockResolvedValue(undefined);

			await processMessage(mockPayload, mockEnv);

			expect(downloadFile).toHaveBeenCalledWith(mockEnv, "file-456");
			expect(parseCV).toHaveBeenCalledWith(
				mockFileBuffer,
				"file-456",
				"PDF",
				mockEnv,
			);
			expect(updateOutboxStatus).toHaveBeenCalledWith(
				mockEnv,
				"log-789",
				"completed",
				mockParsedData,
			);
		});

		it("should throw error when file is not found", async () => {
			vi.mocked(downloadFile).mockResolvedValue(null);

			await expect(processMessage(mockPayload, mockEnv)).rejects.toThrow(
				"File not found in R2: file-456",
			);

			expect(parseCV).not.toHaveBeenCalled();
			expect(updateOutboxStatus).toHaveBeenCalledWith(
				mockEnv,
				"log-789",
				"failed",
				null,
				"File not found in R2: file-456",
			);
		});

		it("should delete file and throw error when file size exceeds limit", async () => {
			// Create a buffer larger than MAXIMUM_UPLOAD_SIZE_BYTES (10MB)
			const largeBuffer = new ArrayBuffer(11 * 1024 * 1024);

			vi.mocked(downloadFile).mockResolvedValue(largeBuffer);
			vi.mocked(deleteFile).mockResolvedValue(undefined);

			await expect(processMessage(mockPayload, mockEnv)).rejects.toThrow(
				/File size .* exceeds maximum allowed size/,
			);

			expect(deleteFile).toHaveBeenCalledWith(mockEnv, "file-456");
			expect(parseCV).not.toHaveBeenCalled();
		});

		it("should handle parsing errors", async () => {
			const mockFileBuffer = new ArrayBuffer(1000);
			const parseError = new Error("Failed to parse CV");

			vi.mocked(downloadFile).mockResolvedValue(mockFileBuffer);
			vi.mocked(parseCV).mockRejectedValue(parseError);

			await expect(processMessage(mockPayload, mockEnv)).rejects.toThrow(
				"Failed to parse CV",
			);

			expect(updateOutboxStatus).toHaveBeenCalledWith(
				mockEnv,
				"log-789",
				"failed",
				null,
				"Failed to parse CV",
			);
		});

		it("should handle outbox update errors for completed status", async () => {
			const mockFileBuffer = new ArrayBuffer(1000);
			const mockParsedData = {
				personal: {
					fullName: "Test User",
					email: null,
					phone: null,
					location: null,
				},
				links: [],
				summary: null,
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "Test",
			};
			const outboxError = new Error("Outbox API failed");

			vi.mocked(downloadFile).mockResolvedValue(mockFileBuffer);
			vi.mocked(parseCV).mockResolvedValue(mockParsedData);
			vi.mocked(updateOutboxStatus).mockRejectedValue(outboxError);

			await expect(processMessage(mockPayload, mockEnv)).rejects.toThrow(
				"Outbox API failed",
			);
		});

		it("should process DOCX files", async () => {
			const docxPayload = { ...mockPayload, fileType: "DOCX" as const };
			const mockFileBuffer = new ArrayBuffer(2000);
			const mockParsedData = {
				personal: {
					fullName: "DOCX User",
					email: null,
					phone: null,
					location: null,
				},
				links: [],
				summary: null,
				experience: [],
				education: [],
				certifications: [],
				languages: [],
				extras: {},
				rawText: "DOCX content",
			};

			vi.mocked(downloadFile).mockResolvedValue(mockFileBuffer);
			vi.mocked(parseCV).mockResolvedValue(mockParsedData);
			vi.mocked(updateOutboxStatus).mockResolvedValue(undefined);

			await processMessage(docxPayload, mockEnv);

			expect(parseCV).toHaveBeenCalledWith(
				mockFileBuffer,
				"file-456",
				"DOCX",
				mockEnv,
			);
		});

		it("should handle download errors", async () => {
			const downloadError = new Error("R2 connection timeout");

			vi.mocked(downloadFile).mockRejectedValue(downloadError);

			await expect(processMessage(mockPayload, mockEnv)).rejects.toThrow(
				"R2 connection timeout",
			);

			expect(updateOutboxStatus).toHaveBeenCalledWith(
				mockEnv,
				"log-789",
				"failed",
				null,
				"R2 connection timeout",
			);
		});
	});
});
