import type { Router as RouterType } from "express";
import { Router } from "express";

import { validateRequest } from "@/app/middleware/validateRequest.js";
import {
	finalizeUploadController,
	finalizeUploadRequestSchema,
} from "@/domain/uploads/controllers/finalizeUpload.controller.js";
import {
	getRawTextController,
	getRawTextParamsSchema,
} from "@/domain/uploads/controllers/getRawText.controller.js";
import {
	initUploadController,
	initUploadRequestSchema,
} from "@/domain/uploads/controllers/initUpload.controller.js";
import {
	updateOutboxBodySchema,
	updateOutboxParamsSchema,
	updateOutboxStatus,
} from "@/domain/uploads/controllers/updateOutboxStatus.controller.js";

export const workerRouter: RouterType = Router();

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
