import type { StoredSession } from "../lib/supabase";
import createSidebar from "./sidebarApp";

type SidebarModule = ReturnType<typeof createSidebar>;

let sidebar: SidebarModule | null = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "SHOW_MODAL") {
    ensureSidebar()
      .then(async (sidebar) => {
        await sidebar.show();
        sendResponse?.({ ok: true });
      })
      .catch((error) => {
        console.error("Failed to open sidebar:", error);
        sendResponse?.({ ok: false, error: String(error) });
      });
    return true;
  }

  if (msg.type === "AUTH_CHANGED") {
    if (!sidebar) return;
    sidebar.updateSession(msg.session ?? null);
  }
});

function ensureSidebar(): Promise<SidebarModule> {
  if (!sidebar) {
    sidebar = createSidebar({ fetchSession, signIn, signOut });
  }
  return Promise.resolve(sidebar);
}

async function fetchSession(): Promise<StoredSession | null> {
  const resp = await sendRuntimeMessage<{ ok: boolean; session: StoredSession | null; error?: string }>({
    type: "GET_AUTH"
  });
  if (!resp?.ok) throw new Error(resp?.error ?? "Unable to fetch session");
  return resp.session ?? null;
}

async function signIn(): Promise<void> {
  const resp = await sendRuntimeMessage<{ ok: boolean; error?: string }>({ type: "OAUTH_START" });
  if (!resp?.ok) throw new Error(resp?.error ?? "Unknown error");
}

async function signOut(): Promise<void> {
  const resp = await sendRuntimeMessage<{ ok: boolean; error?: string }>({ type: "LOGOUT" });
  if (!resp?.ok) throw new Error(resp?.error ?? "Unknown error");
}

function sendRuntimeMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response);
    });
  });
}
