import pino from "pino";

import { env } from "./env.js";

const baseLogger =
	env.NODE_ENV === "development"
		? pino({
				level: env.LOG_LEVEL,
				transport: {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "SYS:standard",
					},
				},
			})
		: pino({
				level: env.LOG_LEVEL,
			});

export const logger = baseLogger;

export const createLogger = (name: string) => baseLogger.child({ name });
