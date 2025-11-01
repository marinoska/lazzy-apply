import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { StoredSession } from "../lib/supabase";

function App() {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_AUTH" }, (resp) => {
      setSession(resp?.session ?? null);
      setLoading(false);
    });
    const onMsg = (msg: any) => {
      if (msg?.type === "AUTH_CHANGED") setSession(msg.session ?? null);
    };
    chrome.runtime.onMessage.addListener(onMsg);
    return () => chrome.runtime.onMessage.removeListener(onMsg);
  }, []);

  const signIn = () => {
    setStatus("Starting OAuth…");
    chrome.runtime.sendMessage({ type: "OAUTH_START" }, (resp) => {
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
    chrome.runtime.sendMessage({ type: "LOGOUT" }, (resp) => {
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
