import type { Express } from "express";
import { Router } from "express";

import { env } from "../app/env.js";
import { healthRouter } from "./health.js";

export const registerRoutes = (app: Express) => {
	const router = Router();

	router.use("/health", healthRouter);

	app.use(env.API_PREFIX, router);
};
