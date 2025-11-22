import { getEnv } from "@/app/env.js";
import { Unauthorized } from "@/app/errors.js";
import type { NextFunction, Request, Response } from "express";

/**
 * Middleware to authenticate requests from Cloudflare Workers
 * Uses a shared secret token for authentication
 */
export const authenticateWorker = async (
	req: Request,
	_res: Response,
	next: NextFunction,
) => {
	console.log("[authenticateWorker] Headers:", req.headers);
	const authHeader =
		req.header("x-worker-secret") ?? req.header("X-Worker-Secret");
	console.log(
		"[authenticateWorker] Auth header:",
		authHeader ? "present" : "missing",
	);

	if (!authHeader) {
		console.error("[authenticateWorker] Missing worker authentication header");
		throw new Unauthorized("Missing worker authentication header");
	}

	const workerSecret = getEnv("WORKER_SECRET");
	console.log(
		"[authenticateWorker] Worker secret configured:",
		workerSecret ? "yes" : "no",
	);
	if (!workerSecret) {
		console.error("[authenticateWorker] WORKER_SECRET is not configured");
		throw new Error("WORKER_SECRET is not configured");
	}

	if (authHeader !== workerSecret) {
		console.error("[authenticateWorker] Invalid worker authentication token");
		throw new Unauthorized("Invalid worker authentication token");
	}

	console.log("[authenticateWorker] Authentication successful");
	return next();
};
