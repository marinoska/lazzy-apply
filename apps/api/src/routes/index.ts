import type { Express } from "express";
import { Router } from "express";

import { env } from "@/app/env.js";
import { authenticateUser } from "@/app/middleware/authenticateUser.js";
import { authenticateWorker } from "@/app/middleware/authenticateWorker.js";
import { validateRequest } from "@/app/middleware/validateRequest.js";
import {
	classifyFormFields,
	classifyFormFieldsBodySchema,
} from "./formFields/classifyFormFields.js";
import {
	updateOutboxBodySchema,
	updateOutboxParamsSchema,
	updateOutboxStatus,
} from "./outbox/updateOutboxStatus.js";
import {
	deleteUploadController,
	deleteUploadParamsSchema,
} from "./uploads/deleteUpload.js";
import {
	uploadLinkController,
	uploadRequestSchema,
} from "./uploads/getUploadLink.js";
import {
	getUploadsController,
	getUploadsQuerySchema,
} from "./uploads/getUploads.js";
import {
	completeUploadController,
	completeUploadRequestSchema,
} from "./uploads/setUploadStatus.js";

export const registerRoutes = (app: Express) => {
	const router = Router();

	router.get("/health", (_req, res) => {
		res.json({ status: "ok" });
	});

	router.post(
		"/uploads/sign",
		authenticateUser,
		validateRequest({ body: uploadRequestSchema }),
		uploadLinkController,
	);
	router.post(
		"/uploads/complete",
		authenticateUser,
		validateRequest({ body: completeUploadRequestSchema }),
		completeUploadController,
	);
	router.get(
		"/uploads",
		authenticateUser,
		validateRequest({ query: getUploadsQuerySchema }),
		getUploadsController,
	);
	router.delete(
		"/uploads/:fileId",
		authenticateUser,
		validateRequest({ params: deleteUploadParamsSchema }),
		deleteUploadController,
	);

	// Form field classification endpoint (called by Chrome extension)
	router.post(
		"/autofill",
		authenticateUser,
		validateRequest({ body: classifyFormFieldsBodySchema }),
		classifyFormFields,
	);

	// Outbox status update endpoint (called by queue consumer worker)
	router.patch(
		"/outbox/:processId",
		authenticateWorker,
		validateRequest({
			params: updateOutboxParamsSchema,
			body: updateOutboxBodySchema,
		}),
		updateOutboxStatus,
	);

	app.use(env.API_PREFIX, router);
};
