import { hash } from "ohash";
import { findCustomFileUploads } from "./customFileUpload.js";

/**
 * Extracts SLD.TLD from the current hostname (e.g., "linkedin.com" from "www.linkedin.com")
 */
function getDomainPrefix(): string {
	const hostname = window.location.hostname;
	const parts = hostname.split(".");
	// Handle cases like "example.com" (2 parts) or "www.example.com" (3+ parts)
	if (parts.length >= 2) {
		return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
	}
	return hostname;
}

/**
 * Creates a prefixed hash with domain: "[SLD].[TLD]:hash:[hashValue]"
 */
function createPrefixedHash(content: Record<string, unknown>): string {
	const domain = getDomainPrefix();
	const hashValue = hash(content);
	return `${domain}:hash:${hashValue}`;
}

/**
 * Properties used for field hash calculation
 */
const FIELD_HASH_PROPERTIES = [
	"tag",
	"type",
	"name",
	"label",
	"placeholder",
	"description",
	"isFileUpload",
] as const;

/**
 * Creates a hashable object from a field using only the hash-relevant properties
 */
function gethashContent(field: Partial<FormField>): Record<string, unknown> {
	return Object.fromEntries(
		FIELD_HASH_PROPERTIES.map((prop) => [prop, field[prop]]),
	);
}

/**
 * Calculates the application form hash from all field hashes and the form URL.
 * The form hash is derived from the sorted list of individual field hashes
 * and the URL to ensure consistent ordering regardless of field detection order.
 */
function calculateFormHash(fields: FormField[], formUrl: string): string {
	const hashes = fields.map((field) => field.hash).sort();
	return createPrefixedHash({ hashes, formUrl });
}

export interface FormField {
	hash: string;
	tag: string;
	type: string;
	name: string;
	label: string | null;
	placeholder: string | null;
	description: string | null;
	isFileUpload: boolean;
	accept?: string | null;
}

export interface ApplicationForm {
	formHash: string;
	formDetected: boolean;
	totalFields: number;
	fields: FormField[];
	/** URL where the form was detected */
	url: string;
	/** Map of field hash to DOM element for filling */
	fieldElements: Map<string, HTMLElement>;
	formElement?: {
		id: string | null;
		name: string | null;
		action: string | null;
		method: string | null;
	};
}

/**
 * Detects job application forms on the page and extracts all field information.
 * Handles both traditional <form> elements and React-driven forms without form tags.
 */
export function detectApplicationForm(): ApplicationForm | null {
	// First try <form> tags - always filter to find application forms
	const forms = Array.from(document.querySelectorAll("form")).filter((form) =>
		isLikelyApplicationForm(form),
	);

	// If no form tags match, detect container as fallback
	let formContainer: Element | null = null;
	if (forms.length === 0) {
		const containers = Array.from(
			document.querySelectorAll("div, section"),
		).filter((el) => {
			const inputs = el.querySelectorAll("input, textarea, select");
			return inputs.length >= 3 && isLikelyApplicationForm(el);
		});

		if (containers.length > 0) {
			formContainer = containers[0];
		}
	}

	// Determine the element to scan (either a form or container)
	const scanElement =
		forms.length > 0
			? forms.length === 1
				? forms[0]
				: forms.reduce((largest, current) => {
						const largestCount = largest.querySelectorAll(
							"input, textarea, select",
						).length;
						const currentCount = current.querySelectorAll(
							"input, textarea, select",
						).length;
						return currentCount > largestCount ? current : largest;
					})
			: formContainer;

	if (!scanElement) return null;

	const fields: FormField[] = [];
	const fieldElements = new Map<string, HTMLElement>();
	const inputs = scanElement.querySelectorAll(
		"input:not([type='hidden']):not([type='checkbox']):not([type='radio']), textarea",
	);

	for (const el of inputs) {
		const partial = extractFieldInfo(
			el as HTMLInputElement | HTMLTextAreaElement,
			scanElement,
		);
		// Only include fields that have a name (required for form submission)
		if (partial.name && partial.hash) {
			const field: FormField = {
				hash: partial.hash,
				tag: partial.tag ?? "input",
				type: partial.type ?? "text",
				name: partial.name,
				label: partial.label ?? null,
				placeholder: partial.placeholder ?? null,
				description: partial.description ?? null,
				isFileUpload: partial.isFileUpload ?? false,
				accept: partial.accept,
			};
			fields.push(field);
			fieldElements.set(field.hash, el as HTMLElement);
		}
	}

	// Detect custom file upload widgets (e.g., Greenhouse data-field containers)
	const existingNames = new Set(fields.map((f) => f.name));
	for (const { element, field: partial } of findCustomFileUploads(
		scanElement,
		existingNames,
	)) {
		if (!partial.name) continue;
		const fieldHash = createPrefixedHash(gethashContent(partial));
		const field: FormField = {
			hash: fieldHash,
			tag: partial.tag ?? "div",
			type: partial.type ?? "file",
			name: partial.name,
			label: partial.label ?? null,
			placeholder: partial.placeholder ?? null,
			description: partial.description ?? null,
			isFileUpload: true,
			accept: partial.accept,
		};
		fields.push(field);
		fieldElements.set(field.hash, element);
	}

	// Require minimum visible fields after extraction
	if (fields.length < MIN_FORM_FIELDS) {
		return null;
	}

	const formElement =
		scanElement.tagName === "FORM"
			? {
					id: scanElement.id || null,
					name: (scanElement as HTMLFormElement).name || null,
					action: (scanElement as HTMLFormElement).action || null,
					method: (scanElement as HTMLFormElement).method || null,
				}
			: undefined;

	// Calculate form hash from all field hashes and URL
	const formUrl = location.href;
	const formHash = calculateFormHash(fields, formUrl);

	return {
		formHash,
		formDetected: true,
		totalFields: fields.length,
		fields,
		url: location.href,
		fieldElements,
		formElement,
	};
}

/** Minimum number of input fields required for a job application form */
const MIN_FORM_FIELDS = 3;

/** Job-specific label patterns that indicate an application form */
const JOB_LABEL_PATTERNS = [
	/resume/i,
	/\bcv\b/i,
	/cover\s*letter/i,
	/sponsorship/i,
	/work\s*authorization/i,
	/notice\s*period/i,
	/salary/i,
	/portfolio/i,
	/linkedin/i,
	/github/i,
];

/** Job-specific field name patterns */
const JOB_FIELD_NAMES = ["resume", "cv", "coverletter", "cover_letter"];

/** Job-specific submit button patterns */
const JOB_SUBMIT_PATTERNS = [
	/submit\s*application/i,
	/apply\s*now/i,
	/apply\s*for\s*(this\s*)?(job|position|role)/i,
	/send\s*application/i,
	/^apply$/i, // Exact match only - avoids "Apply filters", "Apply changes"
];

/**
 * Determines if an element is likely a job application form.
 * Requires BOTH:
 * 1. At least MIN_FORM_FIELDS input fields
 * 2. At least one job-specific signal (label pattern, field name, or resume/CV upload)
 */
function isLikelyApplicationForm(element: Element): boolean {
	// Requirement 1: Form must have at least MIN_FORM_FIELDS input fields
	const inputs = element.querySelectorAll("input, textarea, select");
	if (inputs.length < MIN_FORM_FIELDS) {
		return false;
	}

	// Collect label text for keyword analysis
	// Include both <label> elements and elements with class "label" (common in React forms)
	const labels = Array.from(
		element.querySelectorAll("label, .label, [class*='label']"),
	).map((l) => l.textContent?.toLowerCase() || "");
	const allLabelText = labels.join(" ");

	// Collect field names and ids (React forms often use id instead of name)
	const fieldNames = Array.from(inputs).map((input) =>
		(
			input.getAttribute("name") ||
			input.getAttribute("id") ||
			""
		).toLowerCase(),
	);
	const allFieldNames = fieldNames.join(" ");

	// Requirement 2: Must have at least one job-specific signal

	// Signal: Job-specific patterns in labels
	if (JOB_LABEL_PATTERNS.some((pattern) => pattern.test(allLabelText))) {
		return true;
	}

	// Signal: Job-specific field names
	if (JOB_FIELD_NAMES.some((name) => allFieldNames.includes(name))) {
		return true;
	}

	// Signal: Resume/CV file upload explicitly labeled
	const fileInputs = element.querySelectorAll('input[type="file"]');
	for (const fileInput of fileInputs) {
		const name = fileInput.getAttribute("name")?.toLowerCase() ?? "";
		const id = fileInput.getAttribute("id")?.toLowerCase() ?? "";
		const label =
			getAssociatedLabel(
				fileInput as HTMLInputElement,
				element,
			)?.toLowerCase() ?? "";

		if (
			name.includes("resume") ||
			name.includes("cv") ||
			id.includes("resume") ||
			id.includes("cv") ||
			label.includes("resume") ||
			label.includes("cv") ||
			label.includes("cover letter")
		) {
			return true;
		}
	}

	// Signal: Job-specific submit button text
	const buttons = Array.from(
		element.querySelectorAll("button, input[type='submit']"),
	);
	const buttonTexts = buttons.map(
		(b) => b.textContent?.trim().toLowerCase() || "",
	);
	if (
		buttonTexts.some((text) => JOB_SUBMIT_PATTERNS.some((p) => p.test(text)))
	) {
		return true;
	}

	return false;
}

/**
 * Gets the associated label text for an input element
 */
function getAssociatedLabel(
	input: HTMLInputElement,
	container: Element,
): string | null {
	if (input.id) {
		const label = container.querySelector(`label[for="${input.id}"]`);
		if (label) return label.textContent?.trim() ?? null;
	}
	const closestLabel = input.closest("label");
	if (closestLabel) {
		return closestLabel.textContent?.trim() ?? null;
	}
	return null;
}

/**
 * Finds the label text for an input element using multiple strategies:
 * 1. label[for="id"] - standard HTML label association
 * 2. aria-label attribute
 * 3. aria-labelledby attribute
 * 4. Wrapping <label> element
 * 5. Previous sibling elements (div, span, label, p)
 * 6. Parent container's first text-containing child before the input
 */
function findLabelForElement(
	el: HTMLInputElement | HTMLTextAreaElement,
	form: Element,
): string | null {
	// Strategy 1: label[for="id"]
	if (el.id) {
		const lbl = form.querySelector(`label[for="${el.id}"]`);
		if (lbl) {
			const text = lbl.textContent?.trim();
			if (text) return text;
		}
	}

	// Strategy 2: aria-label attribute
	const ariaLabel = el.getAttribute("aria-label");
	if (ariaLabel?.trim()) {
		return ariaLabel.trim();
	}

	// Strategy 3: aria-labelledby attribute
	const ariaLabelledBy = el.getAttribute("aria-labelledby");
	if (ariaLabelledBy) {
		const labelEl = document.getElementById(ariaLabelledBy);
		if (labelEl) {
			const text = labelEl.textContent?.trim();
			if (text) return text;
		}
	}

	// Strategy 4: Wrapping <label> element
	const closestLabel = el.closest("label");
	if (closestLabel) {
		// Get label text without the input's value
		const text =
			Array.from(closestLabel.childNodes)
				.filter((node) => node.nodeType === Node.TEXT_NODE)
				.map((node) => node.textContent?.trim())
				.filter(Boolean)
				.join(" ") || closestLabel.textContent?.trim();
		if (text) return text;
	}

	// Strategy 5: Previous sibling elements
	const labelText = findLabelFromSiblings(el);
	if (labelText) return labelText;

	// Strategy 6: Look in parent wrapper for label-like elements before the input
	const labelFromParent = findLabelFromParentWrapper(el);
	if (labelFromParent) return labelFromParent;

	return null;
}

/**
 * Looks for label text in previous sibling elements
 */
function findLabelFromSiblings(el: Element): string | null {
	let sibling = el.previousElementSibling;

	// Check up to 3 previous siblings
	for (let i = 0; i < 3 && sibling; i++) {
		const tag = sibling.tagName.toLowerCase();

		// Common label-like elements
		if (["label", "span", "div", "p", "legend"].includes(tag)) {
			// Skip if it's an input wrapper or contains inputs
			if (sibling.querySelector("input, textarea, select")) {
				sibling = sibling.previousElementSibling;
				continue;
			}

			const text = sibling.textContent?.trim();
			// Must have text and be reasonably short (labels are typically short)
			if (text && text.length > 0 && text.length < 200) {
				return text;
			}
		}

		sibling = sibling.previousElementSibling;
	}

	return null;
}

/**
 * Looks for label text in the parent wrapper element
 * Handles cases like:
 * <div class="field-wrapper">
 *   <div class="label-text">First Name</div>
 *   <input id="first_name" />
 * </div>
 */
function findLabelFromParentWrapper(el: Element): string | null {
	// Look up to 3 levels of parent wrappers
	let parent = el.parentElement;

	for (let level = 0; level < 3 && parent; level++) {
		// Find all text-containing elements before the input in this parent
		const children = Array.from(parent.children);
		const inputIndex = children.indexOf(el);

		if (inputIndex === -1) {
			// Input might be nested deeper, try to find its container
			const inputContainer = children.find((child) => child.contains(el));
			if (inputContainer) {
				const containerIndex = children.indexOf(inputContainer);
				// Look at elements before the input container
				for (let i = containerIndex - 1; i >= 0; i--) {
					const candidate = children[i];
					if (!candidate.querySelector("input, textarea, select")) {
						const text = candidate.textContent?.trim();
						if (text && text.length > 0 && text.length < 200) {
							return text;
						}
					}
				}
			}
		} else {
			// Look at elements before the input
			for (let i = inputIndex - 1; i >= 0; i--) {
				const candidate = children[i];
				if (!candidate.querySelector("input, textarea, select")) {
					const text = candidate.textContent?.trim();
					if (text && text.length > 0 && text.length < 200) {
						return text;
					}
				}
			}
		}

		parent = parent.parentElement;
	}

	return null;
}

/**
 * Extracts comprehensive information about a form field.
 */
function extractFieldInfo(
	el: HTMLInputElement | HTMLTextAreaElement,
	form: Element,
): Partial<FormField> {
	const field: Partial<FormField> = {};

	field.tag = el.tagName.toLowerCase();
	field.type =
		el.getAttribute("type") ||
		(el.tagName === "TEXTAREA" ? "textarea" : "text");

	field.name = el.name || el.id || undefined;
	field.placeholder = (el as HTMLInputElement).placeholder || null;

	// Find label using multiple strategies
	field.label = findLabelForElement(el, form);

	// Description text from aria-describedby
	let description: string | null = null;
	const ariaDescribedBy = el.getAttribute("aria-describedby");
	const describedIds = (ariaDescribedBy || "").split(" ").filter((x) => x);
	if (describedIds.length > 0) {
		description =
			describedIds
				.map((id) => {
					const descEl = document.getElementById(id);
					return descEl ? descEl.textContent?.trim() : null;
				})
				.filter(Boolean)
				.join(" ") || null;
	}
	field.description = description;

	// Detect file uploads
	if (field.type === "file") {
		field.isFileUpload = true;
		field.accept = el.getAttribute("accept") || null;
	} else {
		field.isFileUpload = false;
	}

	// Calculate field hash from stable identifying properties
	field.hash = createPrefixedHash(gethashContent(field));

	return field;
}
