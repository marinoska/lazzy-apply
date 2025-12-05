import type { ParseCVQueueMessage } from "@lazyapply/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types";
import { handleQueueBatch } from "./queueHandler";

// Mock the messageProcessor module
vi.mock("./messageProcessor", () => ({
	processMessage: vi.fn(),
}));

import { processMessage } from "./messageProcessor";

describe("queueHandler", () => {
	let mockEnv: Env;
	let mockCtx: ExecutionContext;
	let mockMessage: Message<ParseCVQueueMessage>;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEnv = {
			UPLOADS_BUCKET: {} as R2Bucket,
			PARSE_CV_DLQ: {
				send: vi.fn(),
				sendBatch: vi.fn(),
			} as Queue<ParseCVQueueMessage>,
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

		mockCtx = {
			waitUntil: vi.fn(),
			passThroughOnException: vi.fn(),
		} as unknown as ExecutionContext;

		mockMessage = {
			id: "test-message-id",
			timestamp: new Date(),
			attempts: 1,
			body: {
				uploadId: "upload-123",
				fileId: "file-456",
				processId: "log-789",
				userId: "user-001",
				fileType: "PDF",
			},
			retry: vi.fn(),
			ack: vi.fn(),
		} as Message<ParseCVQueueMessage>;
	});

	describe("handleQueueBatch", () => {
		it("should process all messages successfully", async () => {
			const batch = {
				messages: [mockMessage],
				queue: "test-queue",
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			} as MessageBatch<ParseCVQueueMessage>;

			vi.mocked(processMessage).mockResolvedValue(undefined);

			await handleQueueBatch(batch, mockEnv, mockCtx);

			expect(processMessage).toHaveBeenCalledTimes(1);
			expect(processMessage).toHaveBeenCalledWith(mockMessage.body, mockEnv);
			expect(mockMessage.retry).not.toHaveBeenCalled();
			expect(mockEnv.PARSE_CV_DLQ.send).not.toHaveBeenCalled();
		});

		it("should retry failed message when attempts < 3", async () => {
			const batch = {
				messages: [mockMessage],
				queue: "test-queue",
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			} as MessageBatch<ParseCVQueueMessage>;

			const error = new Error("Processing failed");
			vi.mocked(processMessage).mockRejectedValue(error);

			await handleQueueBatch(batch, mockEnv, mockCtx);

			expect(processMessage).toHaveBeenCalledTimes(1);
			expect(mockMessage.retry).toHaveBeenCalledTimes(1);
			expect(mockEnv.PARSE_CV_DLQ.send).not.toHaveBeenCalled();
		});

		it("should send to DLQ when attempts >= 3", async () => {
			const failedMessage = {
				...mockMessage,
				attempts: 3,
			} as Message<ParseCVQueueMessage>;
			const batch = {
				messages: [failedMessage],
				queue: "test-queue",
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			} as MessageBatch<ParseCVQueueMessage>;

			const error = new Error("Processing failed");
			vi.mocked(processMessage).mockRejectedValue(error);

			await handleQueueBatch(batch, mockEnv, mockCtx);

			expect(processMessage).toHaveBeenCalledTimes(1);
			expect(mockMessage.retry).not.toHaveBeenCalled();
			expect(mockCtx.waitUntil).toHaveBeenCalledTimes(1);
		});

		it("should handle multiple messages with mixed results", async () => {
			const successMessage = {
				...mockMessage,
				body: { ...mockMessage.body, processId: "log-success" },
			};
			const failMessage = {
				...mockMessage,
				body: { ...mockMessage.body, processId: "log-fail" },
				retry: vi.fn(),
			};

			const batch = {
				messages: [successMessage, failMessage],
				queue: "test-queue",
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			} satisfies MessageBatch<ParseCVQueueMessage>;

			vi.mocked(processMessage)
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error("Failed"));

			await handleQueueBatch(batch, mockEnv, mockCtx);

			expect(processMessage).toHaveBeenCalledTimes(2);
			expect(failMessage.retry).toHaveBeenCalledTimes(1);
		});

		it("should process batch in parallel", async () => {
			const messages = Array.from({ length: 5 }, (_, i) => ({
				...mockMessage,
				body: { ...mockMessage.body, processId: `log-${i}` },
			}));

			const batch = {
				messages,
				queue: "test-queue",
				ackAll: vi.fn(),
				retryAll: vi.fn(),
			} satisfies MessageBatch<ParseCVQueueMessage>;

			vi.mocked(processMessage).mockResolvedValue(undefined);

			await handleQueueBatch(batch, mockEnv, mockCtx);

			expect(processMessage).toHaveBeenCalledTimes(5);
		});
	});
});
