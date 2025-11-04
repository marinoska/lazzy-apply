import pino from "pino";

import { env } from "./env.js";

const baseLogger = pino({
	level: env.LOG_LEVEL,
	...(env.NODE_ENV === "development"
		? {
				transport: {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "SYS:standard",
					},
				},
			}
		: {}),
});

export const logger = baseLogger;

export const createLogger = (name: string) => baseLogger.child({ name });
