import { getSupabase, StoredSession } from "../lib/supabase";

const STORAGE_KEY = "supabaseSession";
bootstrap().catch(console.error);

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "SHOW_MODAL" }, () => {
    const err = chrome.runtime.lastError;
    if (err && !err.message?.includes("Receiving end does not exist")) {
      console.warn("Unable to open modal:", err.message);
    }
  });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "OAUTH_START") {
      await startOAuth("google");
      sendResponse({ ok: true });
    } else if (msg.type === "GET_AUTH") {
      const session = await getStored();
      sendResponse({ ok: true, session });
    } else if (msg.type === "LOGOUT") {
      const supabase = getSupabase();
      await supabase.auth.signOut();
      await chrome.storage.local.remove(STORAGE_KEY);
      chrome.runtime.sendMessage({ type: "AUTH_CHANGED", session: null }, () => {
        const err = chrome.runtime.lastError;
        if (err && !err.message?.includes("Receiving end does not exist")) {
          console.warn("AUTH_CHANGED broadcast failed:", err.message);
        }
      });
      sendResponse({ ok: true });
    }
  })().catch(e => sendResponse({ ok: false, error: String(e) }));
  return true;
});

async function startOAuth(provider: "google") {
  const supabase = getSupabase();
  console.log("Starting OAuth");
  const redirectUrl = chrome.identity.getRedirectURL();
  console.log("Using redirect URL", redirectUrl);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true }
  });
  console.log("OAuth result", { data, error });
  if (error || !data?.url) throw error || new Error("No auth URL");

  console.log("Launching WebAuthFlow", data.url);
  const finalUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true }, (u) => {
      if (chrome.runtime.lastError) {
        const err = chrome.runtime.lastError;
        console.error("launchWebAuthFlow error", err.message ?? err);
        return reject(err);
      }
      if (!u) {
        console.error("launchWebAuthFlow returned empty URL");
        return reject(new Error("No response URL"));
      }
      console.log("Received redirect URL", u);
      resolve(u);
    });
  });
  console.log("Final URL", finalUrl);
  
  // Parse tokens from hash fragment (implicit flow)
  const hash = new URL(finalUrl).hash.substring(1); // Remove '#'
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const expires_at = params.get("expires_at");
  
  if (!access_token || !refresh_token) {
    throw new Error("No tokens in redirect URL");
  }

  // Get user data using the access token
  const { data: userData, error: userErr } = await supabase.auth.getUser(access_token);
  if (userErr) throw userErr;

  const stored: StoredSession = {
    access_token,
    refresh_token,
    expires_at: expires_at ? parseInt(expires_at) : null,
    user: userData.user
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: stored });
  chrome.runtime.sendMessage({ type: "AUTH_CHANGED", session: stored }, () => {
    const err = chrome.runtime.lastError;
    if (err && !err.message?.includes("Receiving end does not exist")) {
      console.warn("AUTH_CHANGED broadcast failed:", err.message);
    }
  });
}

async function bootstrap() {
  const s = await getStored();
  if (!s?.access_token || !s?.refresh_token) return;
  const supabase = getSupabase();
  const { error } = await supabase.auth.setSession({
    access_token: s.access_token,
    refresh_token: s.refresh_token
  });
  if (error) await chrome.storage.local.remove(STORAGE_KEY);
}

async function getStored(): Promise<StoredSession | null> {
  const obj = await chrome.storage.local.get(STORAGE_KEY);
  return (obj?.[STORAGE_KEY] as StoredSession) ?? null;
}
