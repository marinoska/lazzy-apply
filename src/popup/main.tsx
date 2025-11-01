import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { StoredSession } from "../lib/supabase.js";

// Message types sent to background script
interface GetAuthMessage {
  type: "GET_AUTH";
}

interface OAuthStartMessage {
  type: "OAUTH_START";
}

interface LogoutMessage {
  type: "LOGOUT";
}

type BackgroundMessage = GetAuthMessage | OAuthStartMessage | LogoutMessage;

// Message types received from background script
interface AuthChangedMessage {
  type: "AUTH_CHANGED";
  session: StoredSession | null;
}

// Response types
interface MessageResponse {
  ok: boolean;
  session?: StoredSession | null;
  error?: string;
}

function App() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const message: GetAuthMessage = { type: "GET_AUTH" };
    chrome.runtime.sendMessage(message, (resp: MessageResponse) => {
      setSession(resp?.session ?? null);
      setLoading(false);
    });
    const onMsg = (msg: unknown) => {
      if (isAuthChangedMessage(msg)) {
        setSession(msg.session ?? null);
      }
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, []);

  function isAuthChangedMessage(msg: unknown): msg is AuthChangedMessage {
    return (
      typeof msg === "object" &&
      msg !== null &&
      "type" in msg &&
      (msg as AuthChangedMessage).type === "AUTH_CHANGED"
    );
  }

  const signIn = () => {
    setStatus("Starting OAuth…");
    const message: OAuthStartMessage = { type: "OAUTH_START" };
    chrome.runtime.sendMessage(message, (resp: MessageResponse) => {
      if (chrome.runtime.lastError) {
        console.error({error: chrome.runtime.lastError});
        setStatus(`Failed: ${chrome.runtime.lastError.message}`);
        return;
      }
      if (!resp?.ok) {
        console.error({error2: resp?.error});
        setStatus(`Failed: ${resp?.error ?? "Unknown error"}`);
        return;
      }
      setStatus(null);
    });
  };

  const signOut = () => {
    const message: LogoutMessage = { type: "LOGOUT" };
    chrome.runtime.sendMessage(message, (resp: MessageResponse) => {
      if (chrome.runtime.lastError) {
        setStatus(`Failed: ${chrome.runtime.lastError.message}`);
        return;
      }
      if (!resp?.ok) {
        setStatus(`Failed: ${resp?.error ?? "Unknown error"}`);
        return;
      }
      setStatus(null);
    });
  };

  if (loading) return <div style={{ padding: 12 }}>Loading…</div>;

  return (
    <div style={{ padding: 12, minWidth: 280, fontFamily: "system-ui, sans-serif" }}>
      <h3 style={{ marginTop: 0 }}>Login</h3>
      {status && (
        <div style={{ marginBottom: 8, color: status.startsWith("Failed") ? "#b00020" : "#444" }}>
          {status}
        </div>
      )}
      {session ? (
        <>
          <div style={{ marginBottom: 8 }}>
            Signed in as: <b>{session.user?.email ?? "unknown"}</b>
          </div>
          <button onClick={signOut}>Sign out</button>
        </>
      ) : (
        <button onClick={signIn}>Sign in with Google</button>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
