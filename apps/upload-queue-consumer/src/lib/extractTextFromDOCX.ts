import mammoth from "mammoth";

/**
 * Extract text from a DOCX file buffer using Mammoth
 */
export async function extractTextFromDOCX(
	fileBuffer: ArrayBuffer,
): Promise<string> {
	try {
		// Pass ArrayBuffer directly - mammoth supports this natively
		const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });

		// Return extracted text
		return result.value;
	} catch (error) {
		// Re-throw with context - logging handled by caller
		throw new Error(
			`Failed to extract text from DOCX: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
