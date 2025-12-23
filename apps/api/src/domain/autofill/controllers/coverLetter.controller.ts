import {
	COVER_LETTER_CTAS,
	COVER_LETTER_FORMATS,
	COVER_LETTER_LANGUAGES,
	COVER_LETTER_LENGTHS,
	COVER_LETTER_STYLES,
	COVER_LETTER_TONES,
	type CoverLetterSettings,
} from "@lazyapply/types";
import type { Request, Response } from "express";
import { z } from "zod";
import { Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";
import { CVDataModel } from "@/domain/uploads/model/cvData.model.js";
import { UsageModel } from "@/domain/usage/index.js";
import { generateCoverLetter } from "../llm/coverLetter.llm.js";
import { AutofillModel } from "../model/autofill.model.js";

const logger = createLogger("cover-letter");

export const generateCoverLetterBodySchema = z.object({
	autofillId: z.string().min(1),
	jdRawText: z.string().optional(),
	instructions: z.string().optional(),
	formContext: z.string().optional(),
	settings: z
		.object({
			length: z.enum(COVER_LETTER_LENGTHS),
			tone: z.enum(COVER_LETTER_TONES),
			format: z.enum(COVER_LETTER_FORMATS),
			language: z.enum(COVER_LETTER_LANGUAGES),
			cta: z.enum(COVER_LETTER_CTAS),
			style: z.enum(COVER_LETTER_STYLES),
		})
		.optional(),
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
	tone: "professional",
	format: "paragraph",
	language: "neutral",
	cta: "minimal",
	style: "to the point",
};

export async function generateCoverLetterController(
	req: Request<
		Record<string, never>,
		GenerateCoverLetterResponse,
		GenerateCoverLetterBody
	>,
	res: Response<GenerateCoverLetterResponse | GenerateCoverLetterErrorResponse>,
) {
	const user = req.user;
	if (!user) {
		throw new Unauthorized("Missing authenticated user");
	}

	const { autofillId, jdRawText, instructions, formContext, settings } =
		req.body;

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

	await UsageModel.createUsage({
		referenceTable: "autofill",
		reference: autofill._id,
		userId: user.id,
		autofillId,
		type: "cover_letter",
		promptTokens: result.usage.promptTokens,
		completionTokens: result.usage.completionTokens,
		totalTokens: result.usage.totalTokens,
		inputCost: result.usage.inputCost ?? 0,
		outputCost: result.usage.outputCost ?? 0,
		totalCost: result.usage.totalCost ?? 0,
	});

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
