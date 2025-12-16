import type { StoredSession } from "../lib/supabase";
import { LAST_JD_KEY, STORAGE_KEY, TAB_STORAGE_PREFIX } from "./constants";
import type { StoredJD } from "./types";

/**
 * Get stored session from Chrome storage
 */
export async function getStoredSession(): Promise<StoredSession | null> {
	const result = await chrome.storage.local.get(STORAGE_KEY);
	return (result?.[STORAGE_KEY] as StoredSession) ?? null;
}

/**
 * Save session to Chrome storage
 */
export async function saveSession(session: StoredSession): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

/**
 * Remove session from Chrome storage
 */
export async function removeSession(): Promise<void> {
	await chrome.storage.local.remove(STORAGE_KEY);
}

/**
 * Build storage key for tab-specific data.
 * Uses namespaced format: tab:{tabId}:{key}
 * This allows easy identification and cleanup of tab-specific data.
 */
export function buildTabKey(tabId: number, key: string): string {
	return `${TAB_STORAGE_PREFIX}${tabId}:${key}`;
}

/**
 * Get last detected JD from Chrome storage for a specific tab.
 * Each tab stores its own JD to prevent cross-tab data leakage
 * when user has multiple job postings open.
 */
export async function getLastDetectedJD(
	tabId: number,
): Promise<StoredJD | null> {
	const key = buildTabKey(tabId, LAST_JD_KEY);
	const result = await chrome.storage.local.get(key);
	return (result?.[key] as StoredJD) ?? null;
}

/**
 * Save last detected JD to Chrome storage for a specific tab.
 * Called when content script detects a job description page.
 */
export async function saveLastDetectedJD(
	tabId: number,
	jd: StoredJD,
): Promise<void> {
	const key = buildTabKey(tabId, LAST_JD_KEY);
	await chrome.storage.local.set({ [key]: jd });
}

/**
 * Remove JD data for a specific tab from Chrome storage.
 * Called when a tab is closed for immediate cleanup.
 */
export async function removeLastDetectedJD(tabId: number): Promise<void> {
	const key = buildTabKey(tabId, LAST_JD_KEY);
	await chrome.storage.local.remove(key);
}

/**
 * Clean up storage for tabs that no longer exist.
 *
 * This handles:
 * - Crash recovery: removes data from tabs that existed before a browser crash
 * - Stale data: removes data from reused tab IDs after extension reload
 *
 * Called on:
 * - chrome.runtime.onStartup (browser restart)
 * - chrome.runtime.onInstalled (extension install/update)
 * - chrome.tabs.onCreated (periodic cleanup opportunity)
 */
export async function cleanupStaleTabData(): Promise<void> {
	const tabs = await chrome.tabs.query({});
	const activeTabIds = new Set(
		tabs.map((t) => t.id).filter((id): id is number => id !== undefined),
	);

	const all = await chrome.storage.local.get(null);

	const keysToRemove = Object.keys(all).filter((key) => {
		if (!key.startsWith(TAB_STORAGE_PREFIX)) return false;

		const tabId = Number(key.split(":")[1]);
		return !activeTabIds.has(tabId);
	});

	if (keysToRemove.length > 0) {
		await chrome.storage.local.remove(keysToRemove);
		console.log(`[Storage] Cleaned up ${keysToRemove.length} stale tab keys`);
	}
}
