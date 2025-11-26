import mammoth from "mammoth";
import { Buffer } from "node:buffer";

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
		console.error("Error extracting text from DOCX:", error);
		throw new Error(
			`Failed to extract text from DOCX: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
