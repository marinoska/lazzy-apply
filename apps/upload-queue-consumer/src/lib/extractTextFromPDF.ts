import * as pdfjsLib from "pdfjs-dist";

/**
 * Extract text from a PDF file buffer using PDF.js
 */
export async function extractTextFromPDF(
	fileBuffer: ArrayBuffer,
): Promise<string> {
	try {
		// Load the PDF document
		const loadingTask = pdfjsLib.getDocument({
			data: new Uint8Array(fileBuffer),
		});
		const pdf = await loadingTask.promise;

		const textParts: string[] = [];

		// Extract text from each page
		for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
			const page = await pdf.getPage(pageNum);
			const textContent = await page.getTextContent();

			// Combine text items from the page
			const pageText = textContent.items
				.map((item: any) => {
					if ("str" in item) {
						return item.str;
					}
					return "";
				})
				.join(" ");

			textParts.push(pageText);
		}

		// Join all pages with double newline
		return textParts.join("\n\n");
	} catch (error) {
		console.error("Error extracting text from PDF:", error);
		throw new Error(
			`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
