import {
	COVER_LETTER_CTAS,
	COVER_LETTER_FORMATS,
	COVER_LETTER_LANGUAGES,
	COVER_LETTER_LENGTHS,
	COVER_LETTER_STYLES,
	COVER_LETTER_TONES,
} from "@lazyapply/types";
import type { Request, Response } from "express";
import { z } from "zod";
import { Unauthorized } from "@/app/errors.js";
import { createLogger } from "@/app/logger.js";

const logger = createLogger("cover-letter");

export const generateCoverLetterBodySchema = z.object({
	autofillId: z.string().min(1),
	instructions: z.string().optional(),
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

	const { autofillId, instructions, settings } = req.body;

	logger.debug(
		{
			autofillId,
			userId: user.id,
			hasInstructions: !!instructions,
			settings,
		},
		"Generate cover letter request received",
	);

	logger.debug(
		{
			autofillId,
			userId: user.id,
		},
		"Cover letter generation completed (placeholder)",
	);

	return res.status(200).json({
		autofillId,
		coverLetter:
			"Dear Hiring Manager,\n\nI am writing to express my interest in this position...\n\n[Cover letter content will be generated here based on your CV and the job description]\n\nBest regards",
	});
}
