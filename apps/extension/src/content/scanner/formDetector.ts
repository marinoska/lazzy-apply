import { hash } from "ohash";

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
 * Calculates the application form hash from all field hashes.
 * The form hash is derived from the sorted list of individual field hashes
 * to ensure consistent ordering regardless of field detection order.
 */
function calculateFormHash(fields: FormField[]): string {
	const hashes = fields.map((field) => field.hash).sort();
	return createPrefixedHash({ hashes });
}

export interface FormField {
	hash: string;
	id: string | null;
	tag: string;
	type: string;
	name: string | null;
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
	const inputs = scanElement.querySelectorAll(
		"input:not([type='hidden']):not([type='checkbox']):not([type='radio']), textarea",
	);

	inputs.forEach((el) => {
		const field = extractFieldInfo(
			el as HTMLInputElement | HTMLTextAreaElement,
			scanElement,
		);
		// Only include fields that have an id
		if (field.id) {
			fields.push(field);
		}
	});

	const formElement =
		scanElement.tagName === "FORM"
			? {
					id: scanElement.id || null,
					name: (scanElement as HTMLFormElement).name || null,
					action: (scanElement as HTMLFormElement).action || null,
					method: (scanElement as HTMLFormElement).method || null,
				}
			: undefined;

	// Calculate form hash from all field hashes
	const formHash = calculateFormHash(fields);

	return {
		formHash,
		formDetected: true,
		totalFields: fields.length,
		fields,
		formElement,
	};
}

/**
 * Determines if an element is likely a job application form.
 * Requires at least one strong job-specific signal to avoid false positives.
 * Generic forms (contact, support, medical) won't match because they lack job signals.
 */
function isLikelyApplicationForm(element: Element): boolean {
	let hasStrongJobSignal = false;

	// Collect label text for keyword analysis
	const labels = Array.from(element.querySelectorAll("label")).map(
		(l) => l.textContent?.toLowerCase() || "",
	);
	const allLabelText = labels.join(" ");

	// Collect field names
	const inputs = element.querySelectorAll("input, textarea, select");
	const fieldNames = Array.from(inputs).map((input) =>
		(input.getAttribute("name") || "").toLowerCase(),
	);
	const allFieldNames = fieldNames.join(" ");

	// Strong signal 1: Resume/CV file upload explicitly labeled
	const fileInputs = element.querySelectorAll('input[type="file"]');
	for (const fileInput of fileInputs) {
		const name = fileInput.getAttribute("name")?.toLowerCase() ?? "";
		const label =
			getAssociatedLabel(
				fileInput as HTMLInputElement,
				element,
			)?.toLowerCase() ?? "";

		if (
			name.includes("resume") ||
			name.includes("cv") ||
			label.includes("resume") ||
			label.includes("cv") ||
			label.includes("cover letter")
		) {
			hasStrongJobSignal = true;
			break;
		}
	}

	// Strong signal 2: Job-specific patterns in labels
	const jobPatterns = [
		/resume/i,
		/\bcv\b/i,
		/cover\s*letter/i,
		/sponsorship/i,
		/work\s*authorization/i,
		/notice\s*period/i,
		/experience/i,
		/salary/i,
		/portfolio/i,
		/linkedin/i,
		/github/i,
	];

	if (jobPatterns.some((pattern) => pattern.test(allLabelText))) {
		hasStrongJobSignal = true;
	}

	// Strong signal 3: Job-specific field names
	const jobFieldNames = ["resume", "cv", "coverletter", "cover_letter"];
	if (jobFieldNames.some((name) => allFieldNames.includes(name))) {
		hasStrongJobSignal = true;
	}

	// Strong signal 4: Job-specific submit buttons
	const buttons = Array.from(
		element.querySelectorAll("button, input[type='submit']"),
	);
	const buttonTexts = buttons.map((b) => b.textContent?.toLowerCase() || "");
	const jobSubmitKeywords = [
		"submit application",
		"apply now",
		"apply for",
		"apply",
		"send application",
	];
	if (
		buttonTexts.some((text) =>
			jobSubmitKeywords.some((keyword) => text.includes(keyword)),
		)
	) {
		hasStrongJobSignal = true;
	}

	return hasStrongJobSignal;
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
 * Extracts comprehensive information about a form field.
 */
function extractFieldInfo(
	el: HTMLInputElement | HTMLTextAreaElement,
	form: Element,
): FormField {
	const field: Partial<FormField> = {};

	field.tag = el.tagName.toLowerCase();
	field.type =
		el.getAttribute("type") ||
		(el.tagName === "TEXTAREA" ? "textarea" : "text");

	field.id = el.id || null;
	field.name = el.name || null;
	field.placeholder = (el as HTMLInputElement).placeholder || null;

	// Find label
	let label: string | null = null;

	if (el.id) {
		const lbl = form.querySelector(`label[for="${el.id}"]`);
		if (lbl) label = lbl.textContent?.trim() || null;
	}
	if (!label && el.closest("label")) {
		const closestLabel = el.closest("label");
		if (closestLabel) {
			// Get label text without the input's value
			label =
				Array.from(closestLabel.childNodes)
					.filter((node) => node.nodeType === Node.TEXT_NODE)
					.map((node) => node.textContent?.trim())
					.filter(Boolean)
					.join(" ") ||
				closestLabel.textContent?.trim() ||
				null;
		}
	}

	field.label = label;

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

	return field as FormField;
}
