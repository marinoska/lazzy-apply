import { Buffer } from "node:buffer";
import mammoth from "mammoth";

/**
 * Extract text from a DOCX file buffer using Mammoth
 */
export async function extractTextFromDOCX(
	fileBuffer: ArrayBuffer,
): Promise<string> {
	try {
		// Convert ArrayBuffer to Buffer for mammoth
		const buffer = Buffer.from(fileBuffer);

		// Extract text from DOCX
		const result = await mammoth.extractRawText({ buffer });

		// Return extracted text
		return result.value;
	} catch (error) {
		// Re-throw with context - logging handled by caller
		throw new Error(
			`Failed to extract text from DOCX: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
