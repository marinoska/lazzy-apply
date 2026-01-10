import {
	COVER_LETTER_FORMATS,
	COVER_LETTER_LENGTHS,
	MAX_INSTRUCTIONS_LENGTH,
	type CoverLetterSettings,
} from "@lazyapply/types";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { getEnv } from "@/app/env.js";
import { Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { UsageTracker } from "@/domain/usage/index.js";
import { generateCoverLetter } from "../llm/coverLetter.llm.js";
import { AutofillModel } from "../model/autofill.model.js";
import {
	AUTOFILL_COVER_LETTER_MODEL_NAME,
	type AutofillCoverLetterDocument,
	AutofillCoverLetterModel,
} from "../model/autofillCoverLetter.model.js";

const logger = createLogger("cover-letter");

export const generateCoverLetterBodySchema = z.object({
	jdRawText: z.string().optional(),
	instructions: z.string().max(MAX_INSTRUCTIONS_LENGTH).optional(),
	formContext: z.string().optional(),
	settings: z
		.object({
			length: z.enum(COVER_LETTER_LENGTHS),
			format: z.enum(COVER_LETTER_FORMATS),
		})
		.optional(),
});

export const generateCoverLetterQuerySchema = z.object({
	autofillId: z.string().min(1),
	fieldHash: z.string().min(1),
});

type GenerateCoverLetterBody = z.infer<typeof generateCoverLetterBodySchema>;

type GenerateCoverLetterResponse = {
	autofillId: string;
	coverLetter: string;
};

type GenerateCoverLetterErrorResponse = {
	error: string;
};

const DEFAULT_COVER_LETTER_SETTINGS: CoverLetterSettings = {
	length: "medium",
	format: "paragraph",
};

export async function generateCoverLetterController(
	req: Request<
		Record<string, never>,
		GenerateCoverLetterResponse,
		GenerateCoverLetterBody,
		z.infer<typeof generateCoverLetterQuerySchema>
	>,
	res: Response<GenerateCoverLetterResponse | GenerateCoverLetterErrorResponse>,
) {
	const user = req.user;
	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { jdRawText, instructions, formContext, settings } = req.body;

	const { autofillId, fieldHash } = req.query;

	logger.debug(
		{
			autofillId,
			userId: user.id,
			hasInstructions: !!instructions,
			hasJd: !!jdRawText,
			settings,
		},
		"Generate cover letter request received",
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

	const cvData = await CVDataModel.findById(autofill.cvDataReference)
		.setOptions({ userId: user.id })
		.lean();
	if (!cvData?.rawText) {
		logger.error({ autofillId }, "CV raw text not found for autofill session");
		return res.status(404).json({ error: "CV data not found" });
	}

	const coverLetterSettings: CoverLetterSettings = settings
		? { ...DEFAULT_COVER_LETTER_SETTINGS, ...settings }
		: DEFAULT_COVER_LETTER_SETTINGS;

	const result = await generateCoverLetter({
		cvRawText: cvData.rawText,
		jdRawText: jdRawText ?? "",
		formContext: formContext ?? "",
		settings: coverLetterSettings,
		instructions,
	});

	const usageTracker = new UsageTracker(
		user.id,
		{
			referenceTable: AUTOFILL_COVER_LETTER_MODEL_NAME,
		},
		{
			model: getEnv("OPENAI_MODEL"),
			inputPricePer1M: Number(getEnv("OPENAI_MODEL_INPUT_PRICE_PER_1M")),
			outputPricePer1M: Number(getEnv("OPENAI_MODEL_OUTPUT_PRICE_PER_1M")),
		},
	);
	usageTracker.setAutofillId(autofill._id);

	const session = await mongoose.startSession();
	let coverLetterRecord: AutofillCoverLetterDocument;

	try {
		await session.withTransaction(async () => {
			const [created] = await AutofillCoverLetterModel.create(
				[
					{
						userId: user.id,
						autofillId,
						hash: fieldHash,
						value: result.coverLetter,
						instructions: instructions ?? "",
						length: coverLetterSettings.length,
						format: coverLetterSettings.format,
					},
				],
				{ session },
			);
			coverLetterRecord = created;

			usageTracker.setReference(coverLetterRecord._id);
			usageTracker.setUsage("cover_letter", result.usage);
			await usageTracker.persist(session);
		});
	} finally {
		await session.endSession();
	}

	logger.info(
		{
			autofillId,
			userId: user.id,
			usage: result.usage,
		},
		"Cover letter generation completed",
	);

	return res.status(200).json({
		autofillId,
		coverLetter: result.coverLetter,
	});
}
