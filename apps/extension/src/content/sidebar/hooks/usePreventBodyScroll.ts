import { useEffect } from "react";

/**
 * Prevents main page scroll when a modal is open.
 * The modal lives in a Shadow DOM, but scroll events from touchpad/wheel still target
 * the main page's body. Setting overflow:hidden disables body scrolling, so gestures
 * only affect the modal's internal scrollable area. Original value is restored on close.
 */
export function usePreventBodyScroll(isOpen: boolean) {
	useEffect(() => {
		if (!isOpen) return;

		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = originalOverflow;
		};
	}, [isOpen]);
}
