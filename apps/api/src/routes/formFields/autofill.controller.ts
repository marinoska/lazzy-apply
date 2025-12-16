import { autofillRequestSchema } from "@lazyapply/schemas";
import type {
	AutofillRequest,
	AutofillResponse,
	AutofillResponseData,
} from "@lazyapply/types";
import type { Request, Response } from "express";
import { NotFound, Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { AutofillModel } from "@/formFields/autofill.model.js";
import type { AutofillDocument } from "@/formFields/autofill.types.js";
import { FormModel } from "@/formFields/form.model.js";
import { ClassificationManager } from "./classification.manager.js";

const logger = createLogger("autofill");

export const classifyFormFieldsBodySchema = autofillRequestSchema;

/**
 * Convert stored autofill document to API response format
 */
function buildResponseFromAutofillDoc(
	autofillDoc: AutofillDocument,
): AutofillResponse {
	const fields: AutofillResponseData = {};

	for (const item of autofillDoc.data) {
		if (item.fileUrl && item.fileName && item.fileContentType) {
			fields[item.hash] = {
				fieldName: item.fieldName,
				path: "resume_upload",
				pathFound: true,
				fileUrl: item.fileUrl,
				fileName: item.fileName,
				fileContentType: item.fileContentType,
			};
		} else if (item.value !== undefined) {
			fields[item.hash] = {
				fieldName: item.fieldName,
				path: "unknown",
				pathFound: true,
				value: item.value,
			};
		}
	}

	return {
		autofillId: autofillDoc.autofillId,
		fields,
		fromCache: true,
	};
}

export async function autofill(
	req: Request<unknown, AutofillResponse, AutofillRequest>,
	res: Response<AutofillResponse>,
): Promise<void> {
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

	// If autofillId is provided, return stored autofill data directly
	if (autofillId) {
		logger.info({ autofillId }, "Looking up autofill by ID");
		const autofillDoc = await AutofillModel.findByAutofillId(autofillId);
		if (!autofillDoc || autofillDoc.userId !== user.id) {
			throw new NotFound("Autofill not found");
		}
		res.json(buildResponseFromAutofillDoc(autofillDoc));
		return;
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
			res.json(buildResponseFromAutofillDoc(recentAutofill));
			return;
		}
	}

	logger.info({ formHash: form.formHash, selectedUploadId }, "Processing form");

	const classificationManager = new ClassificationManager(
		form,
		fields,
		user.id,
		selectedUploadId,
		jdRawText ?? "",
		jdUrl ?? "",
		formContext ?? [],
	);
	const { response, fromCache } = await classificationManager.process();

	if (fromCache) {
		logger.info("Returned from DB - no classification needed");
	}

	res.json(response);
}
