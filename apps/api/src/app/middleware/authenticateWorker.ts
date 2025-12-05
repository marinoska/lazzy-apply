import { secureCompare } from "@lazyapply/utils";
import type { NextFunction, Request, Response } from "express";
import { env, getEnv } from "@/app/env.js";
import { Forbidden, Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";

const log = createLogger("authenticateWorker");

/**
 * Validates that the request originates from an allowed Cloudflare Worker URL.
 * Cloudflare Workers send a CF-Worker header with the worker's script name/URL.
 */
function validateWorkerUrl(req: Request): void {
	const cfWorkerHeader = req.header("cf-worker") ?? req.header("CF-Worker");

	if (!cfWorkerHeader) {
		log.warn({}, "Missing CF-Worker header");
		throw new Forbidden("Missing worker origin header");
	}

	const allowedUrls = env.ALLOWED_WORKER_URL_LIST;
	if (allowedUrls.length === 0) {
		log.error({}, "ALLOWED_WORKER_URLS is not configured");
		throw new Error("ALLOWED_WORKER_URLS is not configured");
	}

	const isAllowed = allowedUrls.some((url) => cfWorkerHeader === url);
	if (!isAllowed) {
		log.warn(
			{ cfWorker: cfWorkerHeader },
			"Request from unauthorized worker URL",
		);
		throw new Forbidden("Unauthorized worker origin");
	}

	log.debug({ cfWorker: cfWorkerHeader }, "Worker URL validated");
}

/**
 * Middleware to authenticate requests from Cloudflare Workers.
 * Validates worker URL first (via CF-Worker header), then authenticates via shared secret.
 */
export const authenticateWorker = async (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	// Step 1: Validate worker URL before checking token
	validateWorkerUrl(req);

	// Step 2: Validate shared secret token
	const authHeader =
		req.header("x-worker-secret") ?? req.header("X-Worker-Secret");

	if (!authHeader) {
		log.warn({}, "Missing worker authentication header");
		throw new Unauthorized("Missing worker authentication header");
	}

	const workerSecret = getEnv("WORKER_SECRET");
	if (!workerSecret) {
		log.error({}, "WORKER_SECRET is not configured");
		throw new Error("WORKER_SECRET is not configured");
	}

	if (!secureCompare(authHeader, workerSecret)) {
		log.warn({}, "Invalid worker authentication token");
		throw new Unauthorized("Invalid worker authentication token");
	}

	log.debug({}, "Worker authentication successful");
	return next();
};
