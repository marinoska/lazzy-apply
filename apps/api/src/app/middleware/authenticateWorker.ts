import { secureCompare } from "@lazyapply/utils";
import type { NextFunction, Request, Response } from "express";
import { getEnv } from "@/app/env.js";
import { Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";

const log = createLogger("authenticateWorker");

/**
 * Middleware to authenticate requests from Cloudflare Workers
 * Uses a shared secret token for authentication
 */
export const authenticateWorker = async (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	const authHeader =
		req.header("x-worker-secret") ?? req.header("X-Worker-Secret");

	if (!authHeader) {
		log.warn("Missing worker authentication header");
		throw new Unauthorized("Missing worker authentication header");
	}

	const workerSecret = getEnv("WORKER_SECRET");
	if (!workerSecret) {
		log.error("WORKER_SECRET is not configured");
		throw new Error("WORKER_SECRET is not configured");
	}

	if (!secureCompare(authHeader, workerSecret)) {
		log.warn("Invalid worker authentication token");
		throw new Unauthorized("Invalid worker authentication token");
	}

	log.debug("Worker authentication successful");
	return next();
};
