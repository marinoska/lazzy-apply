import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePreventBodyScroll } from "../hooks/usePreventBodyScroll.js";

describe("usePreventBodyScroll", () => {
	beforeEach(() => {
		document.body.style.overflow = "";
	});

	afterEach(() => {
		document.body.style.overflow = "";
	});

	it("should set body overflow to hidden when modal is open", () => {
		const { rerender } = renderHook(({ open }) => usePreventBodyScroll(open), {
			initialProps: { open: false },
		});

		expect(document.body.style.overflow).toBe("");

		rerender({ open: true });
		expect(document.body.style.overflow).toBe("hidden");
	});

	it("should restore original overflow when modal closes", () => {
		document.body.style.overflow = "auto";

		const { rerender, unmount } = renderHook(
			({ open }) => usePreventBodyScroll(open),
			{ initialProps: { open: true } },
		);

		expect(document.body.style.overflow).toBe("hidden");

		rerender({ open: false });
		// Cleanup runs, restoring original value
		unmount();
		expect(document.body.style.overflow).toBe("auto");
	});

	it("should not modify overflow when modal stays closed", () => {
		document.body.style.overflow = "scroll";

		renderHook(({ open }) => usePreventBodyScroll(open), {
			initialProps: { open: false },
		});

		expect(document.body.style.overflow).toBe("scroll");
	});
});
