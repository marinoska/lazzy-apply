import type { AutofillResponse } from "@lazyapply/types";
import { fillElement } from "../../scanner/elementFilling.js";
import { formStore } from "../../scanner/FormStoreManager.js";
import { detectApplicationForm } from "../../scanner/formDetector.js";

/**
 * Result of filling cover letter fields
 */
export interface FillCoverLetterResult {
	filled: number;
	skipped: number;
	method: "text" | "file" | "none";
}

/**
 * Creates a PDF blob from cover letter text
 */
export function createCoverLetterPdf(text: string): Blob {
	// Simple PDF creation without external dependencies
	// Using PDF 1.4 format with basic text content
	const lines = text.split("\n");
	const pageWidth = 595.28; // A4 width in points
	const pageHeight = 841.89; // A4 height in points
	const margin = 72; // 1 inch margin
	const lineHeight = 14;
	const maxWidth = pageWidth - 2 * margin;
	const fontSize = 11;

	// Wrap text to fit within margins
	const wrappedLines: string[] = [];
	for (const line of lines) {
		if (line.trim() === "") {
			wrappedLines.push("");
			continue;
		}
		// Approximate character width (rough estimate for proportional fonts)
		const charsPerLine = Math.floor(maxWidth / (fontSize * 0.5));
		const words = line.split(" ");
		let currentLine = "";

		for (const word of words) {
			if (`${currentLine} ${word}`.trim().length <= charsPerLine) {
				currentLine = `${currentLine} ${word}`.trim();
			} else {
				if (currentLine) wrappedLines.push(currentLine);
				currentLine = word;
			}
		}
		if (currentLine) wrappedLines.push(currentLine);
	}

	// Build PDF content
	let yPosition = pageHeight - margin;
	const textContent: string[] = [];

	for (const line of wrappedLines) {
		if (yPosition < margin + lineHeight) {
			// Would need pagination for very long letters, but most cover letters fit one page
			break;
		}
		// Escape special PDF characters
		const escapedLine = line
			.replace(/\\/g, "\\\\")
			.replace(/\(/g, "\\(")
			.replace(/\)/g, "\\)");
		textContent.push(
			`BT /F1 ${fontSize} Tf ${margin} ${yPosition} Td (${escapedLine}) Tj ET`,
		);
		yPosition -= lineHeight;
	}

	const stream = textContent.join("\n");
	const streamLength = stream.length;

	const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${stream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000${(streamLength + 330).toString().padStart(3, "0")} 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${streamLength + 400}
%%EOF`;

	return new Blob([pdf], { type: "application/pdf" });
}

/**
 * Fills a file input with a PDF blob
 */
async function fillFileInputWithPdf(
	element: HTMLInputElement,
	pdfBlob: Blob,
	fileName: string,
): Promise<boolean> {
	try {
		const file = new File([pdfBlob], fileName, { type: "application/pdf" });
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(file);
		element.files = dataTransfer.files;

		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));

		console.log(`[CoverLetterFiller] Successfully set PDF file: ${fileName}`);
		return true;
	} catch (error) {
		console.error("[CoverLetterFiller] Error filling file input:", error);
		return false;
	}
}

/**
 * Fills cover letter fields with the provided text
 * Detects whether the field is a file input or text input and handles accordingly
 */
export async function fillCoverLetterFields(
	coverLetterText: string,
	classifications: AutofillResponse,
): Promise<FillCoverLetterResult> {
	const localForm = detectApplicationForm();
	const applicationForm = localForm ?? formStore.getStoredForm();
	const isIframeForm = !localForm && !!applicationForm;

	if (!applicationForm) {
		console.warn("[CoverLetterFiller] No application form found");
		return { filled: 0, skipped: 0, method: "none" };
	}

	// Find cover letter fields from classifications
	const coverLetterEntries = Object.entries(classifications.fields).filter(
		([_, item]) => item.path === "cover_letter",
	);

	if (coverLetterEntries.length === 0) {
		console.warn(
			"[CoverLetterFiller] No cover letter fields found in classifications",
		);
		return { filled: 0, skipped: 0, method: "none" };
	}

	let filled = 0;
	let skipped = 0;
	let method: "text" | "file" | "none" = "none";

	for (const [hash, _classification] of coverLetterEntries) {
		// For iframe forms, we don't have DOM elements in the parent frame.
		// Use field metadata from applicationForm.fields instead.
		if (isIframeForm) {
			const fieldMeta = applicationForm.fields.find((f) => f.hash === hash);
			if (!fieldMeta) {
				console.warn(
					`[CoverLetterFiller] Field metadata not found for hash: ${hash}`,
				);
				skipped++;
				continue;
			}

			if (fieldMeta.isFileUpload) {
				const accept = fieldMeta.accept?.toLowerCase() ?? "";
				const acceptsPdf =
					!accept ||
					accept.includes("pdf") ||
					accept.includes("application/pdf") ||
					accept.includes("*");

				if (acceptsPdf) {
					const pdfBlob = createCoverLetterPdf(coverLetterText);
					const fileName = "cover_letter.pdf";
					formStore.fillCoverLetterFileInIframe(hash, pdfBlob, fileName);
					filled++;
					method = "file";
				} else {
					console.warn(
						`[CoverLetterFiller] File input doesn't accept PDF: ${accept}`,
					);
					skipped++;
				}
			} else {
				// Text field in iframe
				formStore.fillFieldInIframe(hash, coverLetterText);
				filled++;
				method = "text";
			}
			continue;
		}

		// Local form - use DOM element
		const element = applicationForm.fieldElements.get(hash);
		if (!element) {
			console.warn(`[CoverLetterFiller] Element not found for hash: ${hash}`);
			skipped++;
			continue;
		}

		// Check if it's a file input
		if (element instanceof HTMLInputElement && element.type === "file") {
			// Check if the field accepts PDFs
			const accept = element.accept?.toLowerCase() ?? "";
			const acceptsPdf =
				!accept ||
				accept.includes("pdf") ||
				accept.includes("application/pdf") ||
				accept.includes("*");

			if (acceptsPdf) {
				const pdfBlob = createCoverLetterPdf(coverLetterText);
				const fileName = "cover_letter.pdf";
				const success = await fillFileInputWithPdf(element, pdfBlob, fileName);
				if (success) {
					filled++;
					method = "file";
				} else {
					skipped++;
				}
			} else {
				console.warn(
					`[CoverLetterFiller] File input doesn't accept PDF: ${accept}`,
				);
				skipped++;
			}
		} else if (
			element instanceof HTMLTextAreaElement ||
			(element instanceof HTMLInputElement && element.type === "text")
		) {
			// Text field - paste the cover letter text directly
			fillElement(element, coverLetterText);
			filled++;
			method = "text";
		} else {
			console.warn(
				`[CoverLetterFiller] Unsupported element type for hash: ${hash}`,
			);
			skipped++;
		}
	}

	console.log(
		`[CoverLetterFiller] Filled ${filled} fields, skipped ${skipped}, method: ${method}`,
	);
	return { filled, skipped, method };
}
