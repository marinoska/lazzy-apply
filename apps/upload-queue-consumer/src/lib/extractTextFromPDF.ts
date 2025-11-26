import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extract text from a PDF file buffer using unpdf
 * This library is optimized for serverless environments like Cloudflare Workers
 */
export async function extractTextFromPDF(
	fileBuffer: ArrayBuffer,
): Promise<string> {
	try {
		// Get the PDF document proxy
		const document = await getDocumentProxy(new Uint8Array(fileBuffer));

		// Extract text from all pages
		const { text } = await extractText(document, { mergePages: true });

		return text;
	} catch (error) {
		console.error("Error extracting text from PDF:", error);
		throw new Error(
			`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
