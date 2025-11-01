import type { StoredSession } from "../lib/supabase";
import { STORAGE_KEY } from "./constants";

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
