import type { FileUploadContentType, ParsedCVData } from "@lazyapply/types";
import type { Env } from "../types";
import { Logger } from "./logger";
import { extractText } from "./extractText";
import { extractCVData } from "./extractCVData";

/**
 * Parse CV file using AI extraction
 */
export async function parseCV(
	fileBuffer: ArrayBuffer,
	fileId: string,
	expectedFileType: FileUploadContentType,
	env: Env,
): Promise<ParsedCVData> {
	const logger = new Logger(env);
	logger.debug("Starting CV parsing", {
		fileId,
		fileType: expectedFileType,
		operation: "parse",
	});

	// 1. Extract text from PDF or DOCX with type validation
	logger.debug("Extracting text from file", {
		fileId,
		fileType: expectedFileType,
		operation: "extract_text",
	});
	const cvText = await extractText(fileBuffer, expectedFileType);

	logger.debug("Text extraction completed", {
		fileId,
		textLength: cvText.length,
		operation: "extract_text",
	});

	// 2. Extract structured data using GPT-4o-mini
	logger.debug("Calling OpenAI API for data extraction", {
		fileId,
		operation: "openai_extract",
	});
	const parsedData = await extractCVData(cvText, env.OPENAI_API_KEY);

	logger.info("Successfully extracted CV data", {
		fileId,
		operation: "parse",
	});

	return parsedData;
}
