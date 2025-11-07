import type { Express } from "express";
import { Router } from "express";

import { env } from "@/app/env.js";
import { authenticateUser } from "@/app/middleware/authenticateUser.js";
import { validateRequest } from "@/app/middleware/validateRequest.js";
import { uploadController, uploadRequestSchema } from "./uploads.js";

export const registerRoutes = (app: Express) => {
	const router = Router();

	router.get("/health", (_req, res) => {
		res.json({ status: "ok" });
	});

	router.post(
		"/uploads/sign",
		authenticateUser,
		validateRequest({ body: uploadRequestSchema }),
		uploadController,
	);

	app.use(env.API_PREFIX, router);
};
