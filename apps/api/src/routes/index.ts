import type { Express } from "express";
import { Router } from "express";

import { authenticateUser } from "@/app/middleware/authenticateUser.js";
import { authenticateWorker } from "@/app/middleware/authenticateWorker.js";
import { validateRequest } from "@/app/middleware/validateRequest.js";
import {
	autofill,
	classifyFormFieldsBodySchema,
} from "./formFields/autofill.controller.js";
import {
	updateOutboxBodySchema,
	updateOutboxParamsSchema,
	updateOutboxStatus,
} from "./outbox/updateOutboxStatus.controller.js";
import {
	updateSelectedUploadBodySchema,
	updateSelectedUploadController,
} from "./preferences/preferences.controller.js";
import {
	deleteUploadController,
	deleteUploadParamsSchema,
} from "./uploads/deleteUpload.controller.js";
import {
	downloadUploadController,
	downloadUploadParamsSchema,
} from "./uploads/downloadUpload.controller.js";
import {
	finalizeUploadController,
	finalizeUploadRequestSchema,
} from "./uploads/finalizeUpload.controller.js";
import {
	getRawTextController,
	getRawTextParamsSchema,
} from "./uploads/getRawText.controller.js";
import {
	getUploadsController,
	getUploadsQuerySchema,
} from "./uploads/getUploads.controller.js";
import {
	initUploadController,
	initUploadRequestSchema,
} from "./uploads/initUpload.controller.js";

export const registerRoutes = (app: Express) => {
	const publicRouter = Router();
	const workerRouter = Router();
	const userRouter = Router();

	// ─────────────────────────────────────────────────────────────────────────────
	// Public routes
	// ─────────────────────────────────────────────────────────────────────────────

	publicRouter.get("/health", (_req, res) => {
		res.json({ status: "ok" });
	});

	// ─────────────────────────────────────────────────────────────────────────────
	// Worker-authenticated routes (called by Edge Function / Queue Consumer)
	// ─────────────────────────────────────────────────────────────────────────────

	workerRouter.use(authenticateWorker);

	workerRouter.post(
		"/uploads/init",
		validateRequest({ body: initUploadRequestSchema }),
		initUploadController,
	);

	workerRouter.post(
		"/uploads/finalize",
		validateRequest({ body: finalizeUploadRequestSchema }),
		finalizeUploadController,
	);

	workerRouter.get(
		"/uploads/:uploadId/raw-text",
		validateRequest({ params: getRawTextParamsSchema }),
		getRawTextController,
	);

	workerRouter.patch(
		"/outbox/:processId",
		validateRequest({
			params: updateOutboxParamsSchema,
			body: updateOutboxBodySchema,
		}),
		updateOutboxStatus,
	);

	// ─────────────────────────────────────────────────────────────────────────────
	// User-authenticated routes (called by Chrome Extension)
	// ─────────────────────────────────────────────────────────────────────────────

	userRouter.use(authenticateUser);

	userRouter.get(
		"/uploads",
		validateRequest({ query: getUploadsQuerySchema }),
		getUploadsController,
	);

	userRouter.delete(
		"/uploads/:fileId",
		validateRequest({ params: deleteUploadParamsSchema }),
		deleteUploadController,
	);

	userRouter.get(
		"/uploads/:fileId/download",
		validateRequest({ params: downloadUploadParamsSchema }),
		downloadUploadController,
	);

	userRouter.post(
		"/autofill",
		validateRequest({ body: classifyFormFieldsBodySchema }),
		autofill,
	);

	userRouter.patch(
		"/preferences/selected-upload",
		validateRequest({ body: updateSelectedUploadBodySchema }),
		updateSelectedUploadController,
	);

	app.use("/api", publicRouter);
	app.use("/api", userRouter);
	app.use("/worker", workerRouter);
};
