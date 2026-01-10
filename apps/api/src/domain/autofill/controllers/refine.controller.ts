import {
	MAX_INSTRUCTIONS_LENGTH,
	MIN_INSTRUCTIONS_LENGTH,
} from "@lazyapply/types";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { getEnv } from "@/app/env.js";
import { Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { UsageTracker } from "@/domain/usage/index.js";
import { refineFieldValue } from "../llm/index.js";
import { AutofillModel } from "../model/autofill.model.js";
import {
	AUTOFILL_REFINE_MODEL_NAME,
	type AutofillRefineDocument,
	AutofillRefineModel,
} from "../model/autofillRefine.model.js";
import { CVContextVO } from "../services/cvContextVO.js";

const logger = createLogger("autofill-refine");

export const refineBodySchema = z.object({
	fieldLabel: z.string().min(1),
	fieldDescription: z.string(),
	fieldText: z.string().min(1),
	userInstructions: z
		.string()
		.min(MIN_INSTRUCTIONS_LENGTH)
		.max(MAX_INSTRUCTIONS_LENGTH),
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

	const autofill = await AutofillModel.findByAutofillId(autofillId, user.id);
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

	const cvContext = await CVContextVO.load(
		autofill.uploadReference.toString(),
		user.id,
	);

	const result = await refineFieldValue({
		fieldLabel,
		fieldDescription,
		existingAnswer: fieldText,
		userInstructions,
		profileSignals: cvContext.profileSignals,
		summaryFacts: cvContext.summaryFacts,
		experienceFacts: cvContext.experienceFacts,
		jdFacts: autofill.jdFacts || [],
	});

	const usageTracker = new UsageTracker(
		user.id,
		{
			referenceTable: AUTOFILL_REFINE_MODEL_NAME,
		},
		{
			model: getEnv("OPENAI_MODEL"),
			inputPricePer1M: Number(getEnv("OPENAI_MODEL_INPUT_PRICE_PER_1M")),
			outputPricePer1M: Number(getEnv("OPENAI_MODEL_OUTPUT_PRICE_PER_1M")),
		},
	);
	usageTracker.setAutofillId(autofill._id);

	const session = await mongoose.startSession();
	let refineRecord: AutofillRefineDocument;

	try {
		await session.withTransaction(async () => {
			const [created] = await AutofillRefineModel.create(
				[
					{
						userId: user.id,
						autofillId,
						hash: fieldHash,
						value: result.refinedAnswer,
						fieldLabel,
						fieldDescription,
						prevFieldText: fieldText,
						userInstructions,
						routingDecision: result.routingDecision,
					},
				],
				{ session },
			);
			refineRecord = created;

			usageTracker.setReference(refineRecord._id);
			usageTracker.setUsage("autofill_refine", result.usage);
			await usageTracker.persist(session);
		});
	} finally {
		await session.endSession();
	}

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
