import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCV } from "./cvParser";
import type { Env } from "../types";

// Mock dependencies
vi.mock("./extractText", () => ({
	extractText: vi.fn(),
}));

vi.mock("./extractCVData", () => ({
	extractCVData: vi.fn(),
}));

import { extractText } from "./extractText";
import { extractCVData } from "./extractCVData";

describe("cvParser", () => {
	let mockEnv: Env;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEnv = {
			UPLOADS_BUCKET: {} as R2Bucket,
			PARSE_CV_DLQ: {} as Queue,
			API_URL: "http://test-api.com",
			WORKER_SECRET: "test-secret",
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

	describe("parseCV", () => {
		it("should successfully parse a PDF CV", async () => {
			const mockBuffer = new ArrayBuffer(100);
			const mockText = "Sample CV text content";
			const mockParsedData = {
				parsedData: {
					personal: {
						fullName: "Jane Doe",
						email: "jane@example.com",
						phone: null,
						location: null,
						nationality: null,
						rightToWork: null,
					},
					links: [],
					summary: "Software Engineer",
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
					rawText: mockText,
				},
				usage: {
					promptTokens: 100,
					completionTokens: 50,
					totalTokens: 150,
					inputCost: 0.001,
					outputCost: 0.0005,
					totalCost: 0.0015,
				},
				finishReason: 'stop' as const,
			};

			vi.mocked(extractText).mockResolvedValue(mockText);
			vi.mocked(extractCVData).mockResolvedValue(mockParsedData);

			const result = await parseCV(mockBuffer, "file-123", "PDF", mockEnv);

			expect(extractText).toHaveBeenCalledWith(mockBuffer, "PDF");
			expect(extractCVData).toHaveBeenCalledWith(mockText, mockEnv);
			expect(result).toEqual(mockParsedData);
		});

		it("should successfully parse a DOCX CV", async () => {
			const mockBuffer = new ArrayBuffer(200);
			const mockText = "DOCX CV content";
			const mockParsedData = {
				parsedData: {
					personal: {
						fullName: "John Smith",
						email: null,
						phone: null,
						location: null,
						nationality: null,
						rightToWork: null,
					},
					links: [],
					summary: null,
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
					rawText: mockText,
				},
				usage: {
					promptTokens: 80,
					completionTokens: 40,
					totalTokens: 120,
					inputCost: 0.0008,
					outputCost: 0.0004,
					totalCost: 0.0012,
				},
				finishReason: 'stop' as const,
			};

			vi.mocked(extractText).mockResolvedValue(mockText);
			vi.mocked(extractCVData).mockResolvedValue(mockParsedData);

			const result = await parseCV(mockBuffer, "file-456", "DOCX", mockEnv);

			expect(extractText).toHaveBeenCalledWith(mockBuffer, "DOCX");
			expect(extractCVData).toHaveBeenCalledWith(mockText, mockEnv);
			expect(result).toEqual(mockParsedData);
		});

		it("should throw error when text extraction fails", async () => {
			const mockBuffer = new ArrayBuffer(100);
			const error = new Error("Failed to extract text");

			vi.mocked(extractText).mockRejectedValue(error);

			await expect(
				parseCV(mockBuffer, "file-789", "PDF", mockEnv),
			).rejects.toThrow("Failed to extract text");

			expect(extractCVData).not.toHaveBeenCalled();
		});

		it("should throw error when AI extraction fails", async () => {
			const mockBuffer = new ArrayBuffer(100);
			const mockText = "Sample text";
			const error = new Error("OpenAI API error");

			vi.mocked(extractText).mockResolvedValue(mockText);
			vi.mocked(extractCVData).mockRejectedValue(error);

			await expect(
				parseCV(mockBuffer, "file-999", "PDF", mockEnv),
			).rejects.toThrow("OpenAI API error");
		});

		it("should handle empty text extraction", async () => {
			const mockBuffer = new ArrayBuffer(50);
			const emptyText = "";
			const mockParsedData = {
				parsedData: {
					personal: {
						fullName: null,
						email: null,
						phone: null,
						location: null,
						nationality: null,
						rightToWork: null,
					},
					links: [],
					summary: null,
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
					rawText: emptyText,
				},
				usage: {
					promptTokens: 50,
					completionTokens: 20,
					totalTokens: 70,
					inputCost: 0.0005,
					outputCost: 0.0002,
					totalCost: 0.0007,
				},
				finishReason: 'stop' as const,
			};

			vi.mocked(extractText).mockResolvedValue(emptyText);
			vi.mocked(extractCVData).mockResolvedValue(mockParsedData);

			const result = await parseCV(mockBuffer, "file-empty", "PDF", mockEnv);

			expect(result).toEqual(mockParsedData);
		});
	});
});
