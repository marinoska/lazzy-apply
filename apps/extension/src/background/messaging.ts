import type { StoredSession } from "../lib/supabase";
import type { AuthChangedMessage } from "./types";

/**
 * Broadcast auth state change to all content scripts
 */
export function broadcastAuthChange(session: StoredSession | null): void {
  const message: AuthChangedMessage = { type: "AUTH_CHANGED", session };
  chrome.runtime.sendMessage(message, () => {
    const error = chrome.runtime.lastError;
    if (error && !isExpectedError(error.message)) {
      console.warn("[DynoJob] Failed to broadcast auth change:", error.message);
    }
  });
}

/**
 * Check if error message is expected (e.g., no receivers)
 */
export function isExpectedError(message?: string): boolean {
  return message?.includes("Receiving end does not exist") ?? false;
}
