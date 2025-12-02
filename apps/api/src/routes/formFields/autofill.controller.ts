import type { Request, Response } from "express";

import { env } from "@/app/env.js";
import { createLogger } from "@/app/logger.js";
import { HttpError } from "@/app/errors.js";
import type { AutofillRequest, AutofillResponse } from "@lazyapply/types";
import { autofillRequestSchema } from "@lazyapply/schemas";
import { processAutofillRequest } from "./classification.manager.js";

const logger = createLogger("autofill");

export const classifyFormFieldsBodySchema = autofillRequestSchema;

export async function autofill(
	req: Request<unknown, AutofillResponse, AutofillRequest>,
	res: Response<AutofillResponse>,
): Promise<void> {
	const { form, fields } = req.body;

	logger.info({ formHash: form.formHash }, "Processing form");

	const { response, fromCache } = await processAutofillRequest(form, fields);

	if (fromCache) {
		logger.info("Returned from DB - no classification needed");
	}

	res.json(response);
}
