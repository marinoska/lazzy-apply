import type { Request, Response } from "express";

import { createLogger } from "@/app/logger.js";
import type { AutofillRequest, AutofillResponse } from "@lazyapply/types";
import { autofillRequestSchema } from "@lazyapply/schemas";
import { ClassificationManager } from "./classification.manager.js";

const logger = createLogger("autofill");

export const classifyFormFieldsBodySchema = autofillRequestSchema;

export async function autofill(
	req: Request<unknown, AutofillResponse, AutofillRequest>,
	res: Response<AutofillResponse>,
): Promise<void> {
	const { form, fields } = req.body;

	logger.info({ formHash: form.formHash }, "Processing form");

	const classificationManager = new ClassificationManager(form, fields);
	const { response, fromCache } = await classificationManager.process();

	if (fromCache) {
		logger.info("Returned from DB - no classification needed");
	}

	res.json(response);
}
