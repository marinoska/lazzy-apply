import type { StoredSession } from "../lib/supabase";
import { LAST_JD_STORAGE_KEY, STORAGE_KEY } from "./constants";
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
 * Get last detected JD from Chrome storage
 */
export async function getLastDetectedJD(): Promise<StoredJD | null> {
	const result = await chrome.storage.local.get(LAST_JD_STORAGE_KEY);
	return (result?.[LAST_JD_STORAGE_KEY] as StoredJD) ?? null;
}

/**
 * Save last detected JD to Chrome storage
 */
export async function saveLastDetectedJD(jd: StoredJD): Promise<void> {
	await chrome.storage.local.set({ [LAST_JD_STORAGE_KEY]: jd });
}
