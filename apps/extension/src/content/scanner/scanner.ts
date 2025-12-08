import { classifyDocument } from "../classifier/jobDescriptionClassifier.js";
import { formStore } from "./FormStoreManager.js";
import { detectApplicationForm } from "./formDetector.js";
import { extractTextBlocks } from "./textBlocksExtractor.js";

export function scanPage() {
	try {
		const blocks = extractTextBlocks().filter((block) => !isNoise(block.text));

		if (!blocks.length) {
			console.log("No text blocks found, content may still be loading");
			return;
		}

		// Extract text for classification, preserving order
		const paragraphs = blocks.map((block) => block.text);
		const classification = classifyDocument(paragraphs);
		console.log({ classification });

		// Detect application form
		const applicationForm = detectApplicationForm();
		console.log({ applicationForm });

		// If we're in an iframe and found a form, cache it and broadcast to parent
		if (formStore.isIframe && applicationForm) {
			formStore.setCachedIframeForm(applicationForm);
			formStore.broadcastFormToParent(applicationForm);
		}

		try {
			chrome.runtime.sendMessage({
				type: "JD_SCAN",
				url: location.href,
				classification,
				blocks, // Include structured blocks with type information
				applicationForm, // Include detected form data
			});
		} catch (sendError) {
			// Extension context invalidated - extension was reloaded/updated
			if (
				sendError instanceof Error &&
				sendError.message.includes("Extension context invalidated")
			) {
				console.log("Extension context invalidated. Please refresh the page.");
				return;
			}
			throw sendError;
		}
	} catch (e) {
		console.error("LazyApply scanPage error:", e);
	}
}

function isNoise(text: string) {
	const lower = text.toLowerCase();

	return (
		lower.includes("cookies") ||
		lower.includes("privacy") ||
		lower.includes("gdpr") ||
		lower.includes("subscribe") ||
		lower.includes("newsletter") ||
		lower.startsWith("©") ||
		lower.includes("all rights reserved")
	);
}
