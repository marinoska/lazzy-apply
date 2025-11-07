import type { Express } from "express";
import { Router } from "express";

import { env } from "@/app/env.js";
import { authenticateUser } from "@/app/middleware/authenticateUser.js";
import { uploadController } from "./uploads.js";

export const registerRoutes = (app: Express) => {
	const router = Router();

	router.get("/health", (_req, res) => {
		res.json({ status: "ok" });
	});

	router.post("/uploads/sign", authenticateUser, uploadController);

	app.use(env.API_PREFIX, router);
};
