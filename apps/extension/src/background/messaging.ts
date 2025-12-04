import type { StoredSession } from "../lib/supabase";
import type { AuthChangedMessage } from "./types";

/**
 * Broadcast auth state change to all content scripts in all tabs
 */
export async function broadcastAuthChange(
	session: StoredSession | null,
): Promise<void> {
	const message: AuthChangedMessage = { type: "AUTH_CHANGED", session };

	// Send to all tabs' content scripts
	const tabs = await chrome.tabs.query({});
	for (const tab of tabs) {
		if (tab.id !== undefined) {
			chrome.tabs.sendMessage(tab.id, message, () => {
				// Ignore errors - tab may not have content script loaded
				chrome.runtime.lastError;
			});
		}
	}
}

/**
 * Check if error message is expected (e.g., no receivers)
 */
export function isExpectedError(message?: string): boolean {
	return message?.includes("Receiving end does not exist") ?? false;
}
