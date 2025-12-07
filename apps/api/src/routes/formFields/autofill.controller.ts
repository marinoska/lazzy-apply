import { autofillRequestSchema } from "@lazyapply/schemas";
import type { AutofillRequest, AutofillResponse } from "@lazyapply/types";
import type { Request, Response } from "express";
import { Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { ClassificationManager } from "./classification.manager.js";

const logger = createLogger("autofill");

export const classifyFormFieldsBodySchema = autofillRequestSchema;

export async function autofill(
	req: Request<unknown, AutofillResponse, AutofillRequest>,
	res: Response<AutofillResponse>,
): Promise<void> {
	const user = req.user;
	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { form, fields, selectedUploadId } = req.body;

	logger.info({ formHash: form.formHash, selectedUploadId }, "Processing form");

	const classificationManager = new ClassificationManager(
		form,
		fields,
		user.id,
		selectedUploadId,
	);
	const { response, fromCache } = await classificationManager.process();

	if (fromCache) {
		logger.info("Returned from DB - no classification needed");
	}

	res.json(response);
}
