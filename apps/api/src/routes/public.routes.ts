import type { Router as RouterType } from "express";
import { Router } from "express";

export const publicRouter: RouterType = Router();

publicRouter.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});
