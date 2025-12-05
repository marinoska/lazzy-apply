import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	PORT: z.coerce.number().int().min(0).default(3000),
	HOST: z.string(),
	API_PREFIX: z.string().default("/api"),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
		.default("info"),
	ALLOWED_ORIGINS: z.string(),
	MONGO_CONNECTION: z.string(),
	SUPABASE_JWKS_URL: z.string().url(),
	WORKER_SECRET: z.string(),
	ALLOWED_WORKER_URLS: z.string(),
	OPENAI_API_KEY: z.string(),
	OPENAI_MODEL: z.string(),
	/** Price per 1M input tokens in USD */
	OPENAI_MODEL_INPUT_PRICE_PER_1M: z.coerce.number(),
	/** Price per 1M output tokens in USD */
	OPENAI_MODEL_OUTPUT_PRICE_PER_1M: z.coerce.number(),
	IS_LOCAL: z
		.enum(["true", "false"])
		.default("false")
		.transform((val) => val === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	const formattedErrors = parsed.error.flatten().fieldErrors;
	console.error("Invalid environment variables", formattedErrors);
	throw new Error("Invalid environment variables");
}

const base = parsed.data;

const allowedOriginList =
	base.ALLOWED_ORIGINS?.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean) ?? [];

const allowedWorkerUrls =
	base.ALLOWED_WORKER_URLS?.split(",")
		.map((url) => url.trim())
		.filter(Boolean) ?? [];

export const env = {
	...base,
	ALLOWED_ORIGIN_LIST: allowedOriginList,
	ALLOWED_WORKER_URL_LIST: allowedWorkerUrls,
	isLocal: base.IS_LOCAL,
};

export type AppEnv = typeof env;

export function getEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Environment variable ${key} is undefined`);
	}
	return value;
}
