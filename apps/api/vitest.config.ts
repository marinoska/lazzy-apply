import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./src/vitest.setup.ts"],
		env: {
			NODE_ENV: "test",
			HOST: "localhost",
			MONGO_CONNECTION: "mongodb://localhost:27017/test",
			LOG_LEVEL: "silent",
			ALLOWED_ORIGINS: "http://localhost:3000",
			SUPABASE_JWKS_URL: "https://example.supabase.co/.well-known/jwks.json",
			SUPABASE_JWT_SECRET: "test-jwt-secret",
			WORKER_SECRET: "test-worker-secret",
			ALLOWED_WORKER_URLS: "test-worker.example.com,another-worker.example.com",
			OPENAI_API_KEY: "test-openai-key",
			OPENAI_MODEL: "gpt-4o-mini",
			OPENAI_MODEL_INPUT_PRICE_PER_1M: "0.15",
			OPENAI_MODEL_OUTPUT_PRICE_PER_1M: "0.60",
		},
		testTimeout: 30000,
		hookTimeout: 60000,
		fileParallelism: false,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/",
				"dist/",
				"**/*.config.ts",
				"**/*.test.ts",
				"**/*.spec.ts",
			],
		},
		include: ["src/**/*.{test,spec}.ts"],
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
