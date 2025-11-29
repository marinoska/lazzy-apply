import type { ParseCVQueueMessage } from "@lazyapply/types";

export type Env = {
	// R2 Bucket binding
	UPLOADS_BUCKET: R2Bucket;

	// Queue binding for Dead Letter Queue
	PARSE_CV_DLQ: Queue<ParseCVQueueMessage>;

	// API base URL for callbacks
	API_URL: string;

	// Worker authentication secret
	WORKER_SECRET: string;

	// OpenAI API Key for CV extraction
	OPENAI_API_KEY: string;

	// AI Model configuration
	AI_MODEL_NAME: string; // e.g., "gpt-4o-mini"
	AI_MODEL_INPUT_PRICE_PER_1M: string; // Price per 1M input tokens in USD
	AI_MODEL_OUTPUT_PRICE_PER_1M: string; // Price per 1M output tokens in USD

	ENVIRONMENT: "prod" | "dev" | "local";

	// Axiom OpenTelemetry configuration
	AXIOM_API_TOKEN: string;
	AXIOM_OTEL_DATASET: string;

	// Axiom Logs dataset
	AXIOM_LOGS_DATASET: string;
};
