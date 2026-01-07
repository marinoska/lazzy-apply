/**
 * Inferred Field Edit Icon Module
 *
 * Adds floating Edit icons to textarea/text input fields that have
 * inferenceHint: "text_from_jd_cv" in the autofill response.
 * These are fields where the value was AI-generated from JD + CV data.
 *
 * Responsibilities:
 * - Inject floating Edit icons into inferred text fields
 * - Position icons in the bottom-right corner of the field
 * - Handle icon click events (callback-based)
 * - Clean up icons when needed
 * - Handle repositioning on scroll/resize
 */
import type { AutofillResponse, AutofillResponseItem } from "@lazyapply/types";
import { formStore } from "./FormStoreManager.js";
import type { ApplicationForm } from "./formDetector.js";

const EDIT_ICON_CLASS = "lazyapply-edit-icon";
const EDIT_ICON_CONTAINER_CLASS = "lazyapply-edit-icon-container";

type EditIconClickHandler = (hash: string) => void;

interface InferredFieldEditIconManager {
	/**
	 * Add edit icons to all inferred text fields
	 * @param isIframeForm - If true, delegates to iframe via FormStoreManager
	 */
	addEditIcons: (
		applicationForm: ApplicationForm,
		classifications: AutofillResponse,
		onEditClick: EditIconClickHandler,
		isIframeForm?: boolean,
	) => void;

	/**
	 * Add edit icon to a single element (used by iframe handler)
	 */
	addEditIconToElement: (hash: string, element: HTMLElement) => void;

	/**
	 * Remove all edit icons from the page
	 */
	removeAllEditIcons: () => void;

	/**
	 * Remove edit icon for a specific field
	 */
	removeEditIcon: (hash: string) => void;

	/**
	 * Update icon positions (call on scroll/resize)
	 */
	updatePositions: () => void;
}

interface TrackedField {
	hash: string;
	element: HTMLElement;
	iconContainer: HTMLElement;
}

const trackedFields: Map<string, TrackedField> = new Map();
let resizeObserver: ResizeObserver | null = null;
let scrollHandler: (() => void) | null = null;

/**
 * Check if a field should have an edit icon
 * Only textarea and text input fields with inferenceHint: "text_from_jd_cv"
 */
function shouldHaveEditIcon(
	element: HTMLElement,
	classification: AutofillResponseItem,
): boolean {
	if (classification.inferenceHint !== "text_from_jd_cv") {
		return false;
	}

	if (element instanceof HTMLTextAreaElement) {
		return true;
	}

	if (element instanceof HTMLInputElement) {
		const textTypes = ["text", "email", "tel", "url", "search"];
		return textTypes.includes(element.type);
	}

	return false;
}

/**
 * Create the edit icon SVG element
 */
function createEditIconSvg(): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("width", "16");
	svg.setAttribute("height", "16");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "2");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");

	// Pencil icon path (Lucide edit-3)
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("d", "M12 20h9");
	svg.appendChild(path);

	const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path2.setAttribute(
		"d",
		"M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z",
	);
	svg.appendChild(path2);

	return svg;
}

/**
 * Create the edit icon container with styles
 */
function createEditIconContainer(
	hash: string,
	onEditClick: EditIconClickHandler,
): HTMLElement {
	const container = document.createElement("div");
	container.className = EDIT_ICON_CONTAINER_CLASS;
	container.setAttribute("data-field-hash", hash);

	// Apply styles inline to avoid CSS conflicts with host page
	Object.assign(container.style, {
		position: "absolute",
		zIndex: "10",
		width: "28px",
		height: "28px",
		borderRadius: "6px",
		backgroundColor: "rgba(99, 102, 241, 0.7)",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		cursor: "pointer",
		transition: "background-color 0.15s ease, transform 0.15s ease",
		boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
		pointerEvents: "auto",
	});

	const icon = createEditIconSvg();
	icon.classList.add(EDIT_ICON_CLASS);
	Object.assign(icon.style, {
		color: "white",
		width: "16px",
		height: "16px",
	});

	container.appendChild(icon);

	// Hover effects
	container.addEventListener("mouseenter", () => {
		container.style.backgroundColor = "rgba(79, 70, 229, 1)";
		container.style.transform = "scale(1.05)";
	});

	container.addEventListener("mouseleave", () => {
		container.style.backgroundColor = "rgba(99, 102, 241, 0.9)";
		container.style.transform = "scale(1)";
	});

	// Click handler
	container.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		onEditClick(hash);
	});

	// Add title/tooltip
	container.title = "Edit AI-generated response";

	return container;
}

/**
 * Position the icon container relative to the field element
 */
function positionIconContainer(
	container: HTMLElement,
	element: HTMLElement,
): void {
	const rect = element.getBoundingClientRect();
	const scrollX = window.scrollX;
	const scrollY = window.scrollY;

	// Position in bottom-left corner with padding
	const padding = 8;
	const iconSize = 28;

	container.style.left = `${rect.left + scrollX + padding}px`;
	container.style.top = `${rect.bottom + scrollY - iconSize - padding}px`;
}

/**
 * Update positions of all tracked icons
 */
function updateAllPositions(): void {
	for (const tracked of trackedFields.values()) {
		positionIconContainer(tracked.iconContainer, tracked.element);
	}
}

/**
 * Set up global event listeners for repositioning
 */
function setupGlobalListeners(): void {
	if (scrollHandler) return;

	scrollHandler = () => {
		requestAnimationFrame(updateAllPositions);
	};

	window.addEventListener("scroll", scrollHandler, { passive: true });
	window.addEventListener("resize", scrollHandler, { passive: true });

	// ResizeObserver for element size changes
	resizeObserver = new ResizeObserver(() => {
		requestAnimationFrame(updateAllPositions);
	});
}

/**
 * Clean up global event listeners
 */
function cleanupGlobalListeners(): void {
	if (scrollHandler) {
		window.removeEventListener("scroll", scrollHandler);
		window.removeEventListener("resize", scrollHandler);
		scrollHandler = null;
	}

	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}
}

/**
 * Add edit icon to a single field
 */
function addEditIconToField(
	hash: string,
	element: HTMLElement,
	onEditClick: EditIconClickHandler,
): void {
	// Skip if already tracked
	if (trackedFields.has(hash)) {
		return;
	}

	const container = createEditIconContainer(hash, onEditClick);
	document.body.appendChild(container);
	positionIconContainer(container, element);

	// Track the field
	trackedFields.set(hash, {
		hash,
		element,
		iconContainer: container,
	});

	// Observe element for size changes
	resizeObserver?.observe(element);
}

/**
 * Remove edit icon for a specific field
 */
function removeEditIcon(hash: string): void {
	const tracked = trackedFields.get(hash);
	if (!tracked) return;

	tracked.iconContainer.remove();
	resizeObserver?.unobserve(tracked.element);
	trackedFields.delete(hash);

	// Clean up global listeners if no more tracked fields
	if (trackedFields.size === 0) {
		cleanupGlobalListeners();
	}
}

/**
 * Remove all edit icons from the page
 */
function removeAllEditIcons(): void {
	for (const hash of trackedFields.keys()) {
		removeEditIcon(hash);
	}
	cleanupGlobalListeners();
}

/**
 * Collect field hashes that should have edit icons
 */
function _collectInferredFieldHashes(
	applicationForm: ApplicationForm,
	classifications: AutofillResponse,
): string[] {
	const hashes: string[] = [];
	for (const [hash, classification] of Object.entries(classifications.fields)) {
		if (classification.inferenceHint === "text_from_jd_cv") {
			const element = applicationForm.fieldElements.get(hash);
			if (element && shouldHaveEditIcon(element, classification)) {
				hashes.push(hash);
			}
		}
	}
	return hashes;
}

/**
 * Click handler for iframe context - posts message to parent window
 */
function iframeEditClickHandler(hash: string): void {
	console.log(`[EditIcon] Edit clicked for field ${hash}, posting to parent`);
	window.parent.postMessage(
		{
			type: "LAZYAPPLY_EDIT_ICON_CLICKED",
			hash,
		},
		"*",
	);
}

/**
 * Add edit icon to a single element (used by iframe handler)
 */
function addEditIconToElement(hash: string, element: HTMLElement): void {
	setupGlobalListeners();
	addEditIconToField(hash, element, iframeEditClickHandler);
}

/**
 * Add edit icons to all inferred text fields
 */
function addEditIcons(
	applicationForm: ApplicationForm,
	classifications: AutofillResponse,
	onEditClick: EditIconClickHandler,
	isIframeForm = false,
): void {
	// For iframe forms, delegate to FormStoreManager
	if (isIframeForm) {
		const fieldHashes: string[] = [];
		for (const [hash, classification] of Object.entries(
			classifications.fields,
		)) {
			if (classification.inferenceHint === "text_from_jd_cv") {
				fieldHashes.push(hash);
			}
		}
		if (fieldHashes.length > 0) {
			formStore.addEditIconsInIframe(fieldHashes);
		}
		return;
	}

	// Set up global listeners first
	setupGlobalListeners();

	for (const [hash, classification] of Object.entries(classifications.fields)) {
		const element = applicationForm.fieldElements.get(hash);
		if (!element) continue;

		if (shouldHaveEditIcon(element, classification)) {
			addEditIconToField(hash, element, onEditClick);
		}
	}
}

/**
 * Singleton manager for inferred field edit icons
 */
export const inferredFieldEditIcon: InferredFieldEditIconManager = {
	addEditIcons,
	addEditIconToElement,
	removeAllEditIcons,
	removeEditIcon,
	updatePositions: updateAllPositions,
};
