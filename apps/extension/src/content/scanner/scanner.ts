import { classifyDocument } from "../classifier/jobDescriptionClassifier.js";
import { formStore } from "./FormStoreManager.js";
import { type ApplicationForm, detectApplicationForm } from "./formDetector.js";
import { extractTextBlocks } from "./textBlocksExtractor.js";

export function scanPage(): ApplicationForm | null {
	try {
		const blocks = extractTextBlocks().filter((block) => !isNoise(block.text));

		if (!blocks.length) {
			console.log("No text blocks found, content may still be loading");
			return null;
		}

		// Extract text for JD analysis, preserving order
		const paragraphs = blocks.map((block) => block.text);
		const jobDescriptionAnalysis = classifyDocument(paragraphs);

		// Detect application form
		const applicationForm = detectApplicationForm();

		// If we're in an iframe and found a form, cache it and broadcast to parent
		if (formStore.isIframe && applicationForm) {
			formStore.setCachedIframeForm(applicationForm);
			formStore.broadcastFormToParent(applicationForm);
		}

		// chrome.runtime may be undefined in iframes or when extension context is invalidated
		if (chrome.runtime?.sendMessage) {
			try {
				chrome.runtime.sendMessage({
					type: "JD_SCAN",
					url: location.href,
					jobDescriptionAnalysis,
					blocks,
				});
			} catch (sendError) {
				// Extension context invalidated - extension was reloaded/updated
				if (
					sendError instanceof Error &&
					sendError.message.includes("Extension context invalidated")
				) {
					console.log(
						"Extension context invalidated. Please refresh the page.",
					);
					return null;
				}
				throw sendError;
			}
		}

		return applicationForm;
	} catch (e) {
		console.error("LazyApply scanPage error:", e);
		return null;
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
