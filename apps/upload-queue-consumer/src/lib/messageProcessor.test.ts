import type { ParseCVQueueMessage } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types";
import { processMessage } from "./messageProcessor";

// Mock all dependencies
vi.mock("./logger", () => ({
	Logger: vi.fn().mockImplementation(() => ({
		info: vi.fn().mockResolvedValue(undefined),
		warn: vi.fn().mockResolvedValue(undefined),
		error: vi.fn().mockResolvedValue(undefined),
		flush: vi.fn().mockResolvedValue(undefined),
	})),
}));

vi.mock("./extractCVData", () => ({
	extractCVData: vi.fn(),
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

import { extractCVData } from "./extractCVData";
import { updateOutboxStatus } from "./outbox";

describe("messageProcessor", () => {
	let mockEnv: Env;
	let mockPayload: ParseCVQueueMessage;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEnv = {
			UPLOADS_BUCKET: {} as R2Bucket,
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

		mockPayload = {
			uploadId: "upload-123",
			fileId: "file-456",
			processId: "log-789",
			userId: "user-001",
			fileType: "PDF",
		};

		// Mock global fetch
		mockFetch = vi.fn();
		global.fetch = mockFetch;
	});

	describe("processMessage", () => {
		const mockRawText = "Test CV content with experience and education";
		const mockParsedData = {
			personal: {
				fullName: "Test User",
				email: "test@example.com",
				phone: null,
				location: null,
				nationality: null,
				rightToWork: null,
			},
			links: [],
			headline: null,
			summary: "Test summary",
			experience: [],
			education: [],
			certifications: [],
			languages: [],
			extras: {
				drivingLicense: null,
				workPermit: null,
				willingToRelocate: null,
				remotePreference: null,
				noticePeriod: null,
				availability: null,
				salaryExpectation: null,
			},
			rawText: mockRawText,
		};

		const mockUsage = {
			promptTokens: 100,
			completionTokens: 50,
			totalTokens: 150,
			inputCost: 0.000015,
			outputCost: 0.00003,
			totalCost: 0.000045,
		};

		function mockFetchRawTextSuccess(rawText: string = mockRawText) {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ rawText }),
			});
		}

		it("should successfully process a valid message", async () => {
			mockFetchRawTextSuccess();
			vi.mocked(extractCVData).mockResolvedValue({
				parseStatus: "completed",
				parsedData: mockParsedData,
				usage: mockUsage,
				finishReason: "stop" as const,
			});
			vi.mocked(updateOutboxStatus).mockResolvedValue(undefined);

			await processMessage(mockPayload, mockEnv);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://test-api.com/worker/uploads/upload-123/raw-text",
				{
					method: "GET",
					headers: {
						"X-Worker-Secret": "test-secret",
					},
				},
			);
			expect(extractCVData).toHaveBeenCalledWith(mockRawText, mockEnv);
			expect(updateOutboxStatus).toHaveBeenCalledWith(
				mockEnv,
				"log-789",
				"completed",
				mockParsedData,
				undefined,
				mockUsage,
			);
		});

		it("should throw error when raw text fetch fails", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 404,
				text: () => Promise.resolve("Upload not found"),
			});

			await expect(processMessage(mockPayload, mockEnv)).rejects.toThrow(
				"Failed to fetch raw text: 404 Upload not found",
			);

			expect(extractCVData).not.toHaveBeenCalled();
			expect(updateOutboxStatus).toHaveBeenCalledWith(
				mockEnv,
				"log-789",
				"failed",
				null,
				"Failed to fetch raw text: 404 Upload not found",
				undefined,
			);
		});

		it("should handle extraction errors", async () => {
			mockFetchRawTextSuccess();
			const extractError = new Error("Failed to extract CV data: AI error");
			vi.mocked(extractCVData).mockRejectedValue(extractError);

			await expect(processMessage(mockPayload, mockEnv)).rejects.toThrow(
				"Failed to extract CV data: AI error",
			);

			expect(updateOutboxStatus).toHaveBeenCalledWith(
				mockEnv,
				"log-789",
				"failed",
				null,
				"Failed to extract CV data: AI error",
				undefined,
			);
		});

		it("should handle outbox update errors for completed status", async () => {
			mockFetchRawTextSuccess();
			vi.mocked(extractCVData).mockResolvedValue({
				parseStatus: "completed",
				parsedData: mockParsedData,
				usage: mockUsage,
				finishReason: "stop" as const,
			});
			const outboxError = new Error("Outbox API failed");
			vi.mocked(updateOutboxStatus).mockRejectedValue(outboxError);

			await expect(processMessage(mockPayload, mockEnv)).rejects.toThrow(
				"Outbox API failed",
			);
		});

		it("should process messages with different file types", async () => {
			const docxPayload = { ...mockPayload, fileType: "DOCX" as const };
			mockFetchRawTextSuccess();
			vi.mocked(extractCVData).mockResolvedValue({
				parseStatus: "completed",
				parsedData: mockParsedData,
				usage: mockUsage,
				finishReason: "stop" as const,
			});
			vi.mocked(updateOutboxStatus).mockResolvedValue(undefined);

			await processMessage(docxPayload, mockEnv);

			// File type is logged but extraction uses raw text regardless of type
			expect(extractCVData).toHaveBeenCalledWith(mockRawText, mockEnv);
		});

		it("should handle network errors when fetching raw text", async () => {
			const networkError = new Error("Network connection failed");
			mockFetch.mockRejectedValue(networkError);

			await expect(processMessage(mockPayload, mockEnv)).rejects.toThrow(
				"Network connection failed",
			);

			expect(updateOutboxStatus).toHaveBeenCalledWith(
				mockEnv,
				"log-789",
				"failed",
				null,
				"Network connection failed",
				undefined,
			);
		});

		it("should handle not-a-cv response", async () => {
			mockFetchRawTextSuccess();
			vi.mocked(extractCVData).mockResolvedValue({
				parseStatus: "not-a-cv",
				rawText: mockRawText,
				usage: mockUsage,
				finishReason: "stop" as const,
			});
			vi.mocked(updateOutboxStatus).mockResolvedValue(undefined);

			await processMessage(mockPayload, mockEnv);

			expect(updateOutboxStatus).toHaveBeenCalledWith(
				mockEnv,
				"log-789",
				"not-a-cv",
				null,
				undefined,
				mockUsage,
			);
		});
	});
});
