import type { ParsedCVData } from "@lazyapply/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types";
import { updateOutboxStatus } from "./outbox";

describe("outbox", () => {
	let mockEnv: Env;
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFetch = vi.fn();
		global.fetch = mockFetch;

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
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("updateOutboxStatus", () => {
		const mockParsedData: ParsedCVData = {
			personal: {
				fullName: "John Doe",
				email: "john@example.com",
				phone: "+1234567890",
				location: "New York, NY",
			},
			links: [],
			headline: "Senior Software Engineer",
			summary: "Experienced developer",
			experience: [],
			education: [],
			certifications: [],
			languages: [],
			extras: {},
			rawText: "Sample CV text",
		};

		it("should successfully update outbox to completed status", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
			});

			await updateOutboxStatus(mockEnv, "log-123", "completed", mockParsedData);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://test-api.com/worker/outbox/log-123",
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						"X-Worker-Secret": "test-secret",
					},
					body: JSON.stringify({
						status: "completed",
						data: mockParsedData,
						error: undefined,
					}),
				},
			);
		});

		it("should successfully update outbox to failed status", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
			});

			await updateOutboxStatus(
				mockEnv,
				"log-123",
				"failed",
				null,
				"Processing error",
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"http://test-api.com/worker/outbox/log-123",
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						"X-Worker-Secret": "test-secret",
					},
					body: JSON.stringify({
						status: "failed",
						data: null,
						error: "Processing error",
					}),
				},
			);
		});

		it("should throw error when completed status update fails", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				text: vi.fn().mockResolvedValue("Internal server error"),
			});

			await expect(
				updateOutboxStatus(mockEnv, "log-123", "completed", mockParsedData),
			).rejects.toThrow("Failed to update outbox status to completed");
		});

		it("should not throw error when failed status update fails", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				text: vi.fn().mockResolvedValue("Internal server error"),
			});

			// Should not throw
			await expect(
				updateOutboxStatus(mockEnv, "log-123", "failed", null, "Error"),
			).resolves.toBeUndefined();
		});

		it("should handle fetch exception for completed status", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"));

			await expect(
				updateOutboxStatus(mockEnv, "log-123", "completed", mockParsedData),
			).rejects.toThrow("Network error");
		});

		it("should handle fetch exception for failed status", async () => {
			mockFetch.mockRejectedValue(new Error("Network error"));

			// Should not throw
			await expect(
				updateOutboxStatus(mockEnv, "log-123", "failed", null, "Error"),
			).resolves.toBeUndefined();
		});

		it("should use correct API URL and headers", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
			});

			await updateOutboxStatus(mockEnv, "log-456", "completed", mockParsedData);

			const callArgs = mockFetch.mock.calls[0];
			expect(callArgs[0]).toBe("http://test-api.com/worker/outbox/log-456");
			expect(callArgs[1].headers["X-Worker-Secret"]).toBe("test-secret");
		});
	});
});
