import { autofillRequestSchema } from "@lazyapply/schemas";
import type { AutofillRequest, AutofillResponse } from "@lazyapply/types";
import type { Request, Response } from "express";
import { NotFound, Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { AutofillModel } from "@/domain/autofill/model/autofill.model.js";
import { FormModel } from "@/domain/autofill/model/form.model.js";
import { AutofillManager } from "../services/autofill.manager.js";
import { AutofillResponseBuilder } from "./autofillResponseBuilder.js";

const logger = createLogger("autofill");

export const classifyFormFieldsBodySchema = autofillRequestSchema;

export async function autofill(
	req: Request<unknown, AutofillResponse, AutofillRequest>,
	res: Response<AutofillResponse>,
) {
	const user = req.user;
	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const {
		form,
		fields,
		selectedUploadId,
		jdRawText,
		jdUrl,
		formContext,
		autofillId,
	} = req.body;

	const responseBuilder = new AutofillResponseBuilder(
		user.id,
		selectedUploadId,
	);

	// If autofillId is provided, return stored autofill data directly
	if (autofillId) {
		logger.info({ autofillId }, "Looking up autofill by ID");
		const autofillDoc = await AutofillModel.findByAutofillId(autofillId);
		if (!autofillDoc || autofillDoc.userId !== user.id) {
			throw new NotFound("Autofill not found");
		}
		const response = await responseBuilder.build(autofillDoc);
		return res.json({ ...response, fromCache: true });
	}

	// Check if we have a recent autofill for this user/upload/form combination
	const existingForm = await FormModel.findByHash(form.formHash);
	if (existingForm) {
		const recentAutofill = await AutofillModel.findMostRecentByUserUploadForm(
			user.id,
			selectedUploadId,
			existingForm._id.toString(),
		);
		if (recentAutofill) {
			logger.info(
				{ autofillId: recentAutofill.autofillId },
				"Found recent autofill, returning cached data",
			);
			const response = await responseBuilder.build(recentAutofill);
			return res.json({ ...response, fromCache: true });
		}
	}

	logger.info({ formHash: form.formHash, selectedUploadId }, "Processing form");

	const autofillManager = await AutofillManager.create({
		selectedUploadId,
		userId: user.id,
		formInput: form,
		fieldsInput: fields,
	});
	const autofill = await autofillManager.process({
		jdRawText: jdRawText ?? "",
		jdUrl: jdUrl ?? null,
		formUrl: form.pageUrl,
		formContext: formContext ?? "",
	});

	const response = await responseBuilder.build(autofill);
	return res.json({ ...response, fromCache: false });
}
