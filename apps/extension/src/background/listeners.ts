import type { MessageResponse, ShowModalMessage } from "./types.js";
import { isValidMessage, handleMessage } from "./messageHandler.js";
import { isExpectedError } from "./messaging.js";

/**
 * Setup Chrome extension listeners
 */
export function setupListeners(): void {
  // Handle extension icon click - open sidebar in active tab
  chrome.action.onClicked.addListener((tab) => {
    if (!tab.id) {
      console.warn("[LazyJob] No tab ID available");
      return;
    }

    const message: ShowModalMessage = { type: "SHOW_MODAL" };
    chrome.tabs.sendMessage(tab.id, message, () => {
      const error = chrome.runtime.lastError;
      if (error && !isExpectedError(error.message)) {
        console.warn("[LazyJob] Failed to open sidebar:", error.message);
      }
    });
  });

  // Handle messages from content scripts
  chrome.runtime.onMessage.addListener(
    (
      msg: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: MessageResponse) => void
    ) => {
      if (!isValidMessage(msg)) {
        sendResponse({ ok: false, error: "Invalid message format" });
        return false;
      }

      handleMessage(msg, sender, sendResponse);
      return true; // Keep channel open for async response
    }
  );
}
