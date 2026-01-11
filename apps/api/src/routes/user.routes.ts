import type { Router as RouterType } from "express";
import { Router } from "express";

import { validateRequest } from "@/app/middleware/validateRequest.js";
import {
	autofill,
	classifyFormFieldsBodySchema,
} from "@/domain/autofill/controllers/autofill.controller.js";
import {
	generateCoverLetterBodySchema,
	generateCoverLetterController,
} from "@/domain/autofill/controllers/coverLetter.controller.js";
import {
	refineBodySchema,
	refineController,
	refineParamsSchema,
} from "@/domain/autofill/controllers/refine.controller.js";
import {
	updateSelectedUploadBodySchema,
	updateSelectedUploadController,
} from "@/domain/preferences/controllers/preferences.controller.js";
import {
	deleteUploadController,
	deleteUploadParamsSchema,
} from "@/domain/uploads/controllers/deleteUpload.controller.js";
import {
	downloadUploadController,
	downloadUploadParamsSchema,
} from "@/domain/uploads/controllers/downloadUpload.controller.js";
import {
	getUploadsController,
	getUploadsQuerySchema,
} from "@/domain/uploads/controllers/getUploads.controller.js";

export const userRouter: RouterType = Router();

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

userRouter.post(
	"/autofill/refine/:autofillId/:fieldHash",
	validateRequest({ params: refineParamsSchema, body: refineBodySchema }),
	refineController,
);

userRouter.post(
	"/autofill/cover-letter/generate",
	validateRequest({ body: generateCoverLetterBodySchema }),
	generateCoverLetterController,
);

userRouter.get("/usage/cv-window-balance", getCvWindowBalanceController);
