import { getSupabase } from "../lib/supabase.js";
import { getStoredSession, removeSession } from "./storage.js";
import { broadcastAuthChange } from "./messaging.js";

/**
 * Handle logout request
 */
export async function logout(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut();
  await removeSession();
  broadcastAuthChange(null);
}

/**
 * Initialize extension on startup - restore session if available
 */
export async function bootstrap(): Promise<void> {
  console.log("[DynoJob] Initializing...");

  const session = await getStoredSession();
  if (!session?.access_token || !session?.refresh_token) {
    console.log("[DynoJob] No stored session found");
    return;
  }

  const supabase = getSupabase();
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error) {
    console.warn("[DynoJob] Failed to restore session:", error.message);
    await removeSession();
  } else {
    console.log("[DynoJob] Session restored successfully");
  }
}
