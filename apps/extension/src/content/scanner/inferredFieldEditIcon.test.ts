import type { AutofillResponse, AutofillResponseItem } from "@lazyapply/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationForm } from "./formDetector.js";

// Mock formStore with hoisted mocks
const { mockAddEditIconsInIframe, mockRemoveEditIconsInIframe } = vi.hoisted(
	() => ({
		mockAddEditIconsInIframe: vi.fn(),
		mockRemoveEditIconsInIframe: vi.fn(),
	}),
);

vi.mock("./FormStoreManager.js", () => ({
	formStore: {
		addEditIconsInIframe: mockAddEditIconsInIframe,
		removeEditIconsInIframe: mockRemoveEditIconsInIframe,
	},
}));

import { inferredFieldEditIcon } from "./inferredFieldEditIcon.js";

// Mock ResizeObserver for test environment
class MockResizeObserver {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}

vi.stubGlobal("ResizeObserver", MockResizeObserver);

describe("inferredFieldEditIcon", () => {
	let mockForm: ApplicationForm;
	let mockTextarea: HTMLTextAreaElement;
	let mockTextInput: HTMLInputElement;
	let mockEmailInput: HTMLInputElement;
	let mockCheckbox: HTMLInputElement;

	beforeEach(() => {
		// Clean up any existing icons
		inferredFieldEditIcon.removeAllEditIcons();

		// Create mock elements
		mockTextarea = document.createElement("textarea");
		mockTextarea.value = "AI generated text for textarea";
		document.body.appendChild(mockTextarea);

		mockTextInput = document.createElement("input");
		mockTextInput.type = "text";
		mockTextInput.value = "AI generated text for input";
		document.body.appendChild(mockTextInput);

		mockEmailInput = document.createElement("input");
		mockEmailInput.type = "email";
		mockEmailInput.value = "test@example.com";
		document.body.appendChild(mockEmailInput);

		mockCheckbox = document.createElement("input");
		mockCheckbox.type = "checkbox";
		document.body.appendChild(mockCheckbox);

		// Create mock form
		const fieldElements = new Map<string, HTMLElement>();
		fieldElements.set("textarea-hash", mockTextarea);
		fieldElements.set("text-input-hash", mockTextInput);
		fieldElements.set("email-hash", mockEmailInput);
		fieldElements.set("checkbox-hash", mockCheckbox);

		mockForm = {
			formHash: "test-form-hash",
			formDetected: true,
			totalFields: 4,
			fields: [],
			url: "https://example.com/apply",
			fieldElements,
		};
	});

	afterEach(() => {
		inferredFieldEditIcon.removeAllEditIcons();
		mockTextarea.remove();
		mockTextInput.remove();
		mockEmailInput.remove();
		mockCheckbox.remove();
	});

	function createClassifications(
		fields: Record<string, Partial<AutofillResponseItem>>,
	): AutofillResponse {
		const fullFields: Record<string, AutofillResponseItem> = {};
		for (const [hash, partial] of Object.entries(fields)) {
			fullFields[hash] = {
				fieldName: partial.fieldName ?? null,
				label: partial.label ?? null,
				path: partial.path ?? "unknown",
				pathFound: partial.pathFound ?? true,
				value: partial.value ?? "test value",
				...partial,
			};
		}
		return {
			autofillId: "test-autofill-id",
			fields: fullFields,
			fromCache: false,
		};
	}

	describe("addEditIcons", () => {
		it("should add edit icon to textarea with inferenceHint text_from_jd_cv", () => {
			const classifications = createClassifications({
				"textarea-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI generated text",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);

			const icons = document.querySelectorAll(".lazyapply-edit-icon-container");
			expect(icons.length).toBe(1);
			expect(icons[0].getAttribute("data-field-hash")).toBe("textarea-hash");
		});

		it("should add edit icon to text input with inferenceHint text_from_jd_cv", () => {
			const classifications = createClassifications({
				"text-input-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI generated text",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);

			const icons = document.querySelectorAll(".lazyapply-edit-icon-container");
			expect(icons.length).toBe(1);
			expect(icons[0].getAttribute("data-field-hash")).toBe("text-input-hash");
		});

		it("should NOT add edit icon to fields without inferenceHint", () => {
			const classifications = createClassifications({
				"textarea-hash": {
					value: "Some value",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);

			const icons = document.querySelectorAll(".lazyapply-edit-icon-container");
			expect(icons.length).toBe(0);
		});

		it("should NOT add edit icon to checkbox fields even with inferenceHint", () => {
			const classifications = createClassifications({
				"checkbox-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "true",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);

			const icons = document.querySelectorAll(".lazyapply-edit-icon-container");
			expect(icons.length).toBe(0);
		});

		it("should add edit icons to multiple fields", () => {
			const classifications = createClassifications({
				"textarea-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI text 1",
				},
				"text-input-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI text 2",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);

			const icons = document.querySelectorAll(".lazyapply-edit-icon-container");
			expect(icons.length).toBe(2);
		});

		it("should not duplicate icons when called multiple times", () => {
			const classifications = createClassifications({
				"textarea-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI text",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);

			const icons = document.querySelectorAll(".lazyapply-edit-icon-container");
			expect(icons.length).toBe(1);
		});

		it("should delegate to formStore for iframe forms", () => {
			const classifications = createClassifications({
				"textarea-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI text 1",
				},
				"text-input-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI text 2",
				},
				"email-hash": {
					value: "No inference hint",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
				true, // isIframeForm
			);

			// Should NOT add icons locally
			const icons = document.querySelectorAll(".lazyapply-edit-icon-container");
			expect(icons.length).toBe(0);

			// Should delegate to formStore with only inferred field hashes
			expect(mockAddEditIconsInIframe).toHaveBeenCalledWith([
				"textarea-hash",
				"text-input-hash",
			]);
		});
	});

	describe("removeEditIcon", () => {
		it("should remove a specific edit icon", () => {
			const classifications = createClassifications({
				"textarea-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI text 1",
				},
				"text-input-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI text 2",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);

			expect(
				document.querySelectorAll(".lazyapply-edit-icon-container").length,
			).toBe(2);

			inferredFieldEditIcon.removeEditIcon("textarea-hash");

			const icons = document.querySelectorAll(".lazyapply-edit-icon-container");
			expect(icons.length).toBe(1);
			expect(icons[0].getAttribute("data-field-hash")).toBe("text-input-hash");
		});
	});

	describe("removeAllEditIcons", () => {
		it("should remove all edit icons", () => {
			const classifications = createClassifications({
				"textarea-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI text 1",
				},
				"text-input-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI text 2",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);

			expect(
				document.querySelectorAll(".lazyapply-edit-icon-container").length,
			).toBe(2);

			inferredFieldEditIcon.removeAllEditIcons();

			const icons = document.querySelectorAll(".lazyapply-edit-icon-container");
			expect(icons.length).toBe(0);
		});
	});

	describe("click handler", () => {
		it("should call onEditClick with correct parameters when icon is clicked", () => {
			const classifications = createClassifications({
				"textarea-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI generated text",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);

			const icon = document.querySelector(".lazyapply-edit-icon-container");
			expect(icon).not.toBeNull();

			// Simulate click
			icon?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

			expect(onEditClick).toHaveBeenCalledTimes(1);
			expect(onEditClick).toHaveBeenCalledWith("textarea-hash");
		});
	});

	describe("icon positioning", () => {
		it("should position icon in bottom-right corner of field", () => {
			// Mock getBoundingClientRect
			const mockRect = {
				top: 100,
				left: 50,
				bottom: 200,
				right: 350,
				width: 300,
				height: 100,
				x: 50,
				y: 100,
				toJSON: () => ({}),
			};
			vi.spyOn(mockTextarea, "getBoundingClientRect").mockReturnValue(mockRect);

			const classifications = createClassifications({
				"textarea-hash": {
					inferenceHint: "text_from_jd_cv",
					value: "AI text",
				},
			});

			const onEditClick = vi.fn();
			inferredFieldEditIcon.addEditIcons(
				mockForm,
				classifications,
				onEditClick,
			);

			const icon = document.querySelector(
				".lazyapply-edit-icon-container",
			) as HTMLElement;
			expect(icon).not.toBeNull();

			// Icon should be positioned near bottom-right
			// Position = rect.right - iconSize - padding = 350 - 28 - 8 = 314
			expect(icon.style.left).toBe("314px");
			// Position = rect.bottom - iconSize - padding = 200 - 28 - 8 = 164
			expect(icon.style.top).toBe("164px");
		});
	});
});
