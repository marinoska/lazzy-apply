import { describe, expect, it } from "vitest";
import { getSidebarStyles } from "./styles.js";

describe("Sidebar styles", () => {
	const styles = getSidebarStyles();

	describe("toggle tab styles", () => {
		it("should include toggle-tab class definition", () => {
			expect(styles).toContain(".toggle-tab");
		});

		it("should position toggle tab fixed at top right", () => {
			expect(styles).toContain("position: fixed");
			expect(styles).toContain("top: 10px");
			expect(styles).toContain("right: 0");
		});

		it("should set toggle tab width", () => {
			expect(styles).toContain("width: 32px");
		});

		it("should use flexbox layout for toggle tab", () => {
			expect(styles).toContain("display: flex");
			expect(styles).toContain("flex-direction: column");
		});

		it("should include transition for smooth animations", () => {
			expect(styles).toContain("transition: opacity 0.3s ease-in-out");
		});

		it("should have high z-index for toggle tab", () => {
			expect(styles).toContain("z-index: 2147483646");
		});
	});

	describe("toggle tab open button styles", () => {
		it("should include toggle-tab-open class definition", () => {
			expect(styles).toContain(".toggle-tab-open");
		});

		it("should set open button height", () => {
			expect(styles).toContain("height: 60px");
		});

		it("should use blue background for open button", () => {
			expect(styles).toContain("background: rgba(59, 130, 246, 0.95)");
		});

		it("should have rounded top-left corner for open button", () => {
			expect(styles).toContain("border-radius: 8px 0 0 0");
		});

		it("should include hover state for open button", () => {
			expect(styles).toContain(".toggle-tab-open:hover");
			expect(styles).toContain("background: rgba(59, 130, 246, 1)");
		});
	});

	describe("toggle tab close button styles", () => {
		it("should include toggle-tab-close class definition", () => {
			expect(styles).toContain(".toggle-tab-close");
		});

		it("should set close button height", () => {
			expect(styles).toContain("height: 28px");
		});

		it("should use red background for close button", () => {
			expect(styles).toContain("background: rgba(239, 68, 68, 0.95)");
		});

		it("should have rounded bottom-left corner for close button", () => {
			expect(styles).toContain("border-radius: 0 0 0 8px");
		});

		it("should include hover state for close button", () => {
			expect(styles).toContain(".toggle-tab-close:hover");
			expect(styles).toContain("background: rgba(239, 68, 68, 1)");
		});
	});

	describe("toggle tab hidden state", () => {
		it("should include hidden class definition", () => {
			expect(styles).toContain(".toggle-tab.hidden");
		});

		it("should hide tab with opacity and visibility", () => {
			expect(styles).toContain("opacity: 0");
			expect(styles).toContain("visibility: hidden");
		});

		it("should disable pointer events when hidden", () => {
			expect(styles).toContain("pointer-events: none");
		});
	});

	describe("overlay styles", () => {
		it("should include overlay class definition", () => {
			expect(styles).toContain(".overlay");
		});

		it("should position overlay fixed at top right", () => {
			expect(styles).toContain("position: fixed");
			expect(styles).toContain("top: 10px");
			expect(styles).toContain("right: 10px");
		});

		it("should set overlay width", () => {
			expect(styles).toContain("width: calc(380px)");
		});

		it("should have slide animation with transform", () => {
			expect(styles).toContain("transform: translateX(100%)");
			expect(styles).toContain(
				"transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out",
			);
		});

		it("should have highest z-index for overlay", () => {
			expect(styles).toContain("z-index: 2147483647");
		});
	});

	describe("overlay visible state", () => {
		it("should include visible class definition", () => {
			expect(styles).toContain(".overlay.visible");
		});

		it("should show overlay when visible", () => {
			expect(styles).toContain("opacity: 1");
			expect(styles).toContain("visibility: visible");
		});

		it("should slide in overlay when visible", () => {
			expect(styles).toContain("transform: translateX(0)");
		});
	});

	describe("panel styles", () => {
		it("should include panel class definition", () => {
			expect(styles).toContain(".panel");
		});

		it("should have semi-transparent background", () => {
			expect(styles).toContain("background: rgba(255, 255, 255, 0.98)");
		});

		it("should have rounded corners", () => {
			expect(styles).toContain("border-radius: calc(12px)");
		});

		it("should have shadow", () => {
			expect(styles).toContain("box-shadow");
		});

		it("should enable pointer events for panel", () => {
			expect(styles).toContain("pointer-events: auto");
		});
	});

	describe("host styles", () => {
		it("should include :host selector", () => {
			expect(styles).toContain(":host");
		});

		it("should disable pointer events on host by default", () => {
			expect(styles).toContain("pointer-events: none");
		});

		it("should set font family", () => {
			expect(styles).toContain("font-family: system-ui");
		});

		it("should include box-sizing reset", () => {
			expect(styles).toContain("box-sizing: border-box");
		});
	});

	describe("animation timing", () => {
		it("should use consistent 0.3s timing for animations", () => {
			const transitionMatches = styles.match(/0\.3s/g);
			expect(transitionMatches).not.toBeNull();
			expect(transitionMatches?.length).toBeGreaterThan(0);
		});

		it("should use ease-in-out timing function", () => {
			expect(styles).toContain("ease-in-out");
		});
	});

	describe("hover effects", () => {
		it("should include hover state for toggle tab", () => {
			expect(styles).toContain(".toggle-tab:hover");
			expect(styles).toContain("transform: translateX(-2px)");
		});

		it("should brighten buttons on hover", () => {
			expect(styles).toContain("rgba(59, 130, 246, 1)");
			expect(styles).toContain("rgba(239, 68, 68, 1)");
		});
	});
});
