import { getSupabase } from "../lib/supabase.js";
import { getStoredSession, removeSession, saveSession } from "./storage.js";
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
 * Setup auth state change listener to handle token refresh
 */
export function setupAuthListener(): void {
  const supabase = getSupabase();
  
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log("[DynoJob] Auth state changed:", event);
    
    if (event === "TOKEN_REFRESHED" && session) {
      // Update stored session with new tokens
      const updatedSession = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at ? Math.floor(new Date(session.expires_at).getTime() / 1000) : null,
        user: session.user,
      };
      
      await saveSession(updatedSession);
      broadcastAuthChange(updatedSession);
      console.log("[DynoJob] Session tokens refreshed and stored");
    } else if (event === "SIGNED_OUT") {
      await removeSession();
      broadcastAuthChange(null);
      console.log("[DynoJob] User signed out");
    }
  });
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
  
  // Set the session in Supabase client
  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error) {
    console.warn("[DynoJob] Failed to restore session:", error.message);
    await removeSession();
    broadcastAuthChange(null);
    return;
  }

  // If session was refreshed, update storage with new tokens
  if (data.session) {
    const updatedSession = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at ? Math.floor(new Date(data.session.expires_at).getTime() / 1000) : null,
      user: data.session.user,
    };
    
    await saveSession(updatedSession);
    broadcastAuthChange(updatedSession);
    console.log("[DynoJob] Session restored and refreshed successfully");
  } else {
    console.log("[DynoJob] Session restored successfully");
  }
}
