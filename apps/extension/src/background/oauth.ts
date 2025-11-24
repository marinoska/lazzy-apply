import { type StoredSession, getSupabase } from "../lib/supabase.js";
import { broadcastAuthChange } from "./messaging.js";
import { saveSession } from "./storage.js";

/**
 * Start OAuth flow with the specified provider
 */
export async function startOAuth(provider: "google"): Promise<void> {
  const supabase = getSupabase();
  const redirectUrl = chrome.identity.getRedirectURL();

  console.log("[LazyJob] Starting OAuth flow", { provider, redirectUrl });

  // Get OAuth URL from Supabase
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    throw error || new Error("Failed to get OAuth URL");
  }

  // Launch browser OAuth flow
  const finalUrl = await launchWebAuthFlow(data.url);

  // Extract tokens from redirect URL
  const tokens = extractTokensFromUrl(finalUrl);

  // Get user data
  const { data: userData, error: userError } = await supabase.auth.getUser(tokens.access_token);
  if (userError) throw userError;

  // Store session
  const session: StoredSession = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
    user: userData.user,
  };

  await saveSession(session);
  broadcastAuthChange(session);

  console.log("[LazyJob] OAuth flow completed successfully");
}

/**
 * Launch Chrome's web auth flow
 */
function launchWebAuthFlow(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (responseUrl) => {
      const error = chrome.runtime.lastError;

      if (error) {
        console.error("[LazyJob] WebAuthFlow error:", error.message);
        reject(new Error(error.message));
        return;
      }

      if (!responseUrl) {
        reject(new Error("No response URL from OAuth flow"));
        return;
      }

      console.log("[LazyJob] OAuth redirect received");
      resolve(responseUrl);
    });
  });
}

/**
 * Extract OAuth tokens from redirect URL hash
 */
function extractTokensFromUrl(url: string): {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
} {
  const hash = new URL(url).hash.substring(1);
  const params = new URLSearchParams(hash);

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const expires_at = params.get("expires_at");

  if (!access_token || !refresh_token) {
    throw new Error("Missing tokens in OAuth redirect URL");
  }

  return {
    access_token,
    refresh_token,
    expires_at: expires_at ? Number.parseInt(expires_at, 10) : null,
  };
}
