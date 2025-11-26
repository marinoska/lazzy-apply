import type { FileUploadContentType } from "@lazyapply/types";
import { extractTextFromPDF } from "./extractTextFromPDF";
import { extractTextFromDOCX } from "./extractTextFromDOCX";

/**
 * Detect file type from file buffer by checking magic bytes
 */
function detectFileType(
	buffer: ArrayBuffer,
): FileUploadContentType | "unknown" {
	const bytes = new Uint8Array(buffer);

	// PDF magic bytes: %PDF
	if (
		bytes.length >= 4 &&
		bytes[0] === 0x25 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x44 &&
		bytes[3] === 0x46
	) {
		return "PDF";
	}

	// DOCX magic bytes: PK (ZIP format) + check for word/ directory
	// DOCX files are ZIP archives containing XML files
	if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
		// Additional check: look for "word/" in the first few KB
		const text = new TextDecoder().decode(bytes.slice(0, Math.min(4096, bytes.length)));
		if (text.includes("word/")) {
			return "DOCX";
		}
	}

	return "unknown";
}


/**
Here are typical bullet symbols found in CVs:
● (black circle)
• (small black dot)
– (en dash, often used as a fake bullet)
- (hyphen)
▪ (small square)
* (asterisk)
►, », → (arrow-like symbols)

// const bulletRegex = /[\u2022\u25CF\u25AA\u25B6\u00BB\u2192\-–*]/;
 */
const cleanup = (text: string) => {
  // Normalize all bullet-like lines to start with "●"
  return text
    .replace(/\f/g, " ") // Remove page breaks (PDF-specific)
    .replace(/\n[\-–*•▪►»→]\s+/g, " ● ") // Normalize dashed/odd bullets
    .replace(/\n●/g, " ●") // Rejoin broken bullet lines
    .replace(/([^\n])\n(?=[^\n●])/g, "$1 ") // Merge broken sentences
    .replace(/\n{2,}/g, "\n"); // Compact excessive newlines
};

/**
 * Extract text from either PDF or DOCX file
 * Validates that the detected file type matches the expected type
 */
export async function extractText(
	fileBuffer: ArrayBuffer,
	expectedFileType: FileUploadContentType,
): Promise<string> {
	const detectedFileType = detectFileType(fileBuffer);

	console.log(
		`Detected file type: ${detectedFileType}, expected: ${expectedFileType}`,
	);

	// Validate that detected type matches expected type
	if (detectedFileType !== expectedFileType) {
		throw new Error(
			`File type mismatch: expected ${expectedFileType} but detected ${detectedFileType}`,
		);
	}

	switch (detectedFileType) {
		case "PDF":
			return cleanup(await extractTextFromPDF(fileBuffer));
		case "DOCX":
			return cleanup(await extractTextFromDOCX(fileBuffer));
		default:
			throw new Error(
				"Unsupported file format. Only PDF and DOCX files are supported.",
			);
	}
}
