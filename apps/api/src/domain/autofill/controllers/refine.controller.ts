import type { Request, Response } from "express";
import { z } from "zod";
import { Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { UsageModel } from "@/domain/usage/index.js";
import { refineFieldValue } from "../llm/index.js";
import { AutofillModel } from "../model/autofill.model.js";
import { AutofillRefineModel } from "../model/autofillRefine.model.js";

const logger = createLogger("autofill-refine");

export const refineBodySchema = z.object({
	fieldLabel: z.string().min(1),
	fieldDescription: z.string(),
	fieldText: z.string().min(1),
	userInstructions: z.string().min(1),
});

export const refineParamsSchema = z.object({
	autofillId: z.string().min(1),
	fieldHash: z.string().min(1),
});

type RefineParams = z.infer<typeof refineParamsSchema>;
type RefineBody = z.infer<typeof refineBodySchema>;

type RefineResponse = {
	autofillId: string;
	fieldHash: string;
	refinedText: string;
};

type RefineErrorResponse = {
	error: string;
};

export async function refineController(
	req: Request<RefineParams, RefineResponse, RefineBody>,
	res: Response<RefineResponse | RefineErrorResponse>,
) {
	const user = req.user;
	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { autofillId, fieldHash } = req.params;
	const { fieldLabel, fieldDescription, fieldText, userInstructions } =
		req.body;

	logger.debug(
		{
			autofillId,
			userId: user.id,
			fieldLabel,
		},
		"Refine request received",
	);

	const autofill = await AutofillModel.findByAutofillId(autofillId);
	if (!autofill) {
		logger.warn({ autofillId }, "Autofill session not found");
		return res.status(404).json({ error: "Autofill session not found" });
	}

	if (autofill.userId !== user.id) {
		logger.warn(
			{ autofillId, userId: user.id, autofillUserId: autofill.userId },
			"Unauthorized access to autofill session",
		);
		throw new Unauthorized("Unauthorized access to autofill session");
	}

	const cvData = await CVDataModel.findById(autofill.cvDataReference)
		.setOptions({ userId: user.id })
		.lean();
	if (!cvData?.rawText) {
		logger.error({ autofillId }, "CV raw text not found for autofill session");
		return res.status(404).json({ error: "CV data not found" });
	}

	const result = await refineFieldValue({
		cvRawText: cvData.rawText,
		fieldLabel,
		fieldDescription,
		existingAnswer: fieldText,
		userInstructions,
	});

	const refineRecord = await AutofillRefineModel.create({
		autofillId,
		hash: fieldHash,
		value: result.refinedAnswer,
		fieldLabel,
		fieldDescription,
		prevFieldText: fieldText,
		userInstructions,
	});

	await UsageModel.createUsage({
		referenceTable: "autofill_refines",
		reference: refineRecord._id,
		userId: user.id,
		autofillId,
		type: "autofill_refine",
		promptTokens: result.usage.promptTokens,
		completionTokens: result.usage.completionTokens,
		totalTokens: result.usage.totalTokens,
		inputCost: result.usage.inputCost ?? 0,
		outputCost: result.usage.outputCost ?? 0,
		totalCost: result.usage.totalCost ?? 0,
	});

	logger.debug(
		{
			autofillId,
			userId: user.id,
			fieldLabel,
			usage: result.usage,
		},
		"Refine request completed",
	);

	return res.status(200).json({
		autofillId,
		fieldHash,
		refinedText: result.refinedAnswer,
	});
}
