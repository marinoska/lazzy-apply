import type { Express } from "express";

import { authenticateUser } from "@/app/middleware/authenticateUser.js";
import { authenticateWorker } from "@/app/middleware/authenticateWorker.js";
import { publicRouter } from "./public.routes.js";
import { userRouter } from "./user.routes.js";
import { workerRouter } from "./worker.routes.js";

export const registerRoutes = (app: Express) => {
	app.use("/api", publicRouter);
	app.use("/api", authenticateUser, userRouter);
	app.use("/worker", authenticateWorker, workerRouter);
};
