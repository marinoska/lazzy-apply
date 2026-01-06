export interface TextBlock {
	text: string;
	type: "header" | "paragraph";
	element?: string; // e.g., 'h1', 'h2', 'p', 'div'
}

/**
 * Extracts meaningful text blocks from the page.
 * Avoids nested duplicates, layout divs, tiny text, invisible content, and form UI elements.
 */
export function extractTextBlocks(): TextBlock[] {
	const blocks: TextBlock[] = [];

	// 0. Headers: <h1> through <h6> - job titles, section headers
	const headers = Array.from(
		document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
	)
		.filter((el) => {
			// Skip elements inside style/script tags
			if (el.closest("style, script, noscript")) return false;

			// Skip common UI noise elements
			if (
				el.closest(
					'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"]',
				)
			)
				return false;

			// Skip form-related elements
			if (el.closest("form, label, select, option, input, textarea, button"))
				return false;

			// Skip elements with common noise class/id patterns
			const element = el as HTMLElement;
			const classAndId = `${element.className} ${element.id}`.toLowerCase();
			if (
				/(sidebar|menu|nav|header|footer|cookie|banner|ad|promo|related|recommend|similar)/i.test(
					classAndId,
				)
			) {
				return false;
			}

			// Skip hidden elements
			const style = window.getComputedStyle(el);
			if (style.display === "none" || style.visibility === "hidden")
				return false;

			return true;
		})
		.map((el) => ({
			text: el.textContent?.trim().replace(/\s+/g, " ") || "",
			type: "header" as const,
			element: el.tagName.toLowerCase(),
		}))
		.filter((block) => block.text.length > 0);

	blocks.push(...headers);
	// 1. Direct text blocks: <p> and <li>
	const pAndLi = Array.from(document.querySelectorAll("p, li"))
		.filter((el) => {
			// Skip elements inside style/script tags
			if (el.closest("style, script, noscript")) return false;

			// Skip common UI noise elements (generic across all sites)
			if (
				el.closest(
					'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"]',
				)
			)
				return false;

			// Skip form-related elements
			if (
				el.closest(
					"form, label, legend, fieldset, select, option, input, textarea, button",
				)
			)
				return false;

			// Skip elements with common noise class/id patterns
			const element = el as HTMLElement;
			const classAndId = `${element.className} ${element.id}`.toLowerCase();
			if (
				/(sidebar|menu|nav|header|footer|cookie|banner|ad|promo|related|recommend|similar)/i.test(
					classAndId,
				)
			) {
				return false;
			}

			// Skip hidden elements
			const style = window.getComputedStyle(el);
			if (style.display === "none" || style.visibility === "hidden")
				return false;

			return true;
		})
		.map((el) => ({
			text: el.textContent?.trim().replace(/\s+/g, " ") || "",
			type: "paragraph" as const,
			element: el.tagName.toLowerCase(),
		}))
		.filter((block) => block.text.length > 25);

	blocks.push(...pAndLi);

	// 2. Leaf <div> blocks — <div> that contain text but do NOT contain <p> or <li>
	const leafDivs = Array.from(document.querySelectorAll("div"))
		.filter((div) => {
			// Skip elements inside style/script tags
			if (div.closest("style, script, noscript")) return false;

			// Skip common UI noise elements (generic across all sites)
			if (
				div.closest(
					'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"]',
				)
			)
				return false;

			// Skip form-related elements
			if (
				div.closest(
					"form, label, legend, fieldset, select, option, input, textarea, button",
				)
			)
				return false;

			// Skip elements with common noise class/id patterns
			const classAndId = `${div.className} ${div.id}`.toLowerCase();
			if (
				/(sidebar|menu|nav|header|footer|cookie|banner|ad|promo|related|recommend|similar)/i.test(
					classAndId,
				)
			) {
				return false;
			}

			// Skip hidden elements
			const style = window.getComputedStyle(div);
			if (style.display === "none" || style.visibility === "hidden")
				return false;

			const text = div.textContent?.trim() || "";
			if (text.length <= 30) return false; // Balanced threshold
			if (div.querySelector("p, li")) return false; // avoid nested content
			return true;
		})
		.map((div) => ({
			text: div.textContent?.trim().replace(/\s+/g, " ") || "",
			type: "paragraph" as const,
			element: "div",
		}))
		.filter((block) => !isFormNoise(block.text));

	blocks.push(...leafDivs);

	return dedupe(blocks);
}

/**
 * Check if text is form UI noise that should be filtered out
 * Most form elements are now filtered at DOM level, this catches edge cases
 */
function isFormNoise(text: string): boolean {
	// Filter out very short text that's likely UI labels
	if (text.length < 3) {
		return true;
	}

	// Filter out text that's mostly file type extensions or size limits
	if (/\b(png|jpg|jpeg|pdf|doc|docx|txt|rtf)\b.*\b(mb|kb|gb)\b/i.test(text)) {
		return true;
	}

	// Filter out highly repetitive text (e.g., repeated upload instructions)
	const words = text.split(/\s+/);
	if (words.length > 10) {
		const phrases = [];
		for (let i = 0; i < words.length - 3; i++) {
			phrases.push(
				words
					.slice(i, i + 4)
					.join(" ")
					.toLowerCase(),
			);
		}
		const uniquePhrases = new Set(phrases);
		// If same phrases repeat more than 2.5x, it's likely UI noise
		if (phrases.length / uniquePhrases.size > 2.5) {
			return true;
		}
	}

	return false;
}

// Deduplicate by normalized text comparison
function dedupe(list: TextBlock[]): TextBlock[] {
	const seen = new Set<string>();
	const out: TextBlock[] = [];

	for (const block of list) {
		// Normalize text for better deduplication: lowercase + remove extra spaces
		const normalized = block.text.toLowerCase().replace(/\s+/g, " ").trim();

		// Use first 100 chars as fingerprint (increased from 80 for better accuracy)
		const key = normalized.slice(0, 100);

		if (!seen.has(key)) {
			seen.add(key);
			out.push(block);
		}
	}

	return out;
}
