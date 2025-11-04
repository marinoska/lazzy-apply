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
	ALLOWED_ORIGINS: z.string().optional(),
	MONGO_CONNECTION: z.string(),
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

export const env = {
	...base,
	ALLOWED_ORIGIN_LIST: allowedOriginList,
};

export type AppEnv = typeof env;

export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw `${key} is undefined`;
  }
  return value;
}
