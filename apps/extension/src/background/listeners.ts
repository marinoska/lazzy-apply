import { handleMessage, isValidMessage } from "./messageHandler.js";
import { isExpectedError } from "./messaging.js";
import { cleanupStaleTabData, removeLastDetectedJD } from "./storage.js";
import type { MessageResponse, ShowModalMessage } from "./types.js";

/**
 * Setup Chrome extension listeners
 */
export function setupListeners(): void {
	// Clean up stale tab data at strategic moments:
	// - onStartup: handles crash recovery when browser restarts
	// - onInstalled: handles extension update/reinstall scenarios
	// - onCreated: periodic cleanup as user opens new tabs
	chrome.runtime.onStartup.addListener(cleanupStaleTabData);
	chrome.runtime.onInstalled.addListener(cleanupStaleTabData);
	chrome.tabs.onCreated.addListener(cleanupStaleTabData);

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
			sendResponse: (response: MessageResponse) => void,
		) => {
			if (!isValidMessage(msg)) {
				sendResponse({ ok: false, error: "Invalid message format" });
				return false;
			}

			handleMessage(msg, sender, sendResponse);
			return true; // Keep channel open for async response
		},
	);

	// Immediate cleanup when tab is closed (best-effort, may not fire on crash)
	chrome.tabs.onRemoved.addListener((tabId) => {
		removeLastDetectedJD(tabId).catch((error) => {
			console.warn(
				`[LazyJob] Failed to clean up JD storage for tab ${tabId}:`,
				error,
			);
		});
	});
}
