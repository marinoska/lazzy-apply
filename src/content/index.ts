import type { StoredSession } from "../lib/supabase";

type ModalState = {
  visible: boolean;
  loading: boolean;
  status: string | null;
  session: StoredSession | null;
};

const HOST_ID = "dynojob-auth-modal-host";

const state: ModalState = {
  visible: false,
  loading: false,
  status: null,
  session: null
};

let hostEl: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let overlayEl: HTMLDivElement | null = null;
let statusEl: HTMLDivElement | null = null;
let loadingEl: HTMLDivElement | null = null;
let signedInEl: HTMLDivElement | null = null;
let signedOutEl: HTMLDivElement | null = null;
let emailEl: HTMLElement | null = null;
let actionBtn: HTMLButtonElement | null = null;
let closeBtn: HTMLButtonElement | null = null;

let uiReady = false;
let keyListenerAttached = false;

function ensureUi() {
  if (uiReady) return;
  if (document.getElementById(HOST_ID)) {
    uiReady = true;
    return;
  }

  hostEl = document.createElement("div");
  hostEl.id = HOST_ID;
  document.documentElement.appendChild(hostEl);

  shadow = hostEl.attachShadow({ mode: "closed" });

  overlayEl = document.createElement("div");
  overlayEl.className = "overlay";
  overlayEl.setAttribute("role", "presentation");
  overlayEl.setAttribute("aria-hidden", "true");
  overlayEl.tabIndex = -1;

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "dynojob-auth-title");

  closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.textContent = "×";

  const title = document.createElement("h2");
  title.id = "dynojob-auth-title";
  title.textContent = "DynoJob Login";

  statusEl = document.createElement("div");
  statusEl.className = "status";
  statusEl.hidden = true;

  loadingEl = document.createElement("div");
  loadingEl.className = "loading";
  loadingEl.textContent = "Loading…";
  loadingEl.hidden = true;

  signedInEl = document.createElement("div");
  signedInEl.className = "signed-in";
  signedInEl.hidden = true;
  emailEl = document.createElement("strong");
  signedInEl.append("Signed in as ", emailEl);

  signedOutEl = document.createElement("div");
  signedOutEl.className = "signed-out";
  signedOutEl.textContent = "You're not signed in.";
  signedOutEl.hidden = true;

  const actions = document.createElement("div");
  actions.className = "actions";

  actionBtn = document.createElement("button");
  actionBtn.type = "button";
  actionBtn.className = "btn primary";
  actionBtn.textContent = "Sign in with Google";

  actions.append(actionBtn);
  modal.append(closeBtn, title, statusEl, loadingEl, signedInEl, signedOutEl, actions);
  overlayEl.append(modal);

  const style = document.createElement("style");
  style.textContent = `
    :host, :host * {
      box-sizing: border-box;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .overlay {
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      width: min(320px, calc(100vw - 16px));
      max-width: 360px;
      padding: 24px 24px 24px 16px;
      display: flex;
      align-items: flex-start;
      justify-content: stretch;
      z-index: 2147483647;
      opacity: 0;
      visibility: hidden;
      transform: translateX(12px);
      transition: opacity 0.18s ease, transform 0.18s ease;
      pointer-events: none;
      background: linear-gradient(90deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.02));
      backdrop-filter: blur(2px);
      box-shadow: -1px 0 0 rgba(148, 163, 184, 0.25);
    }
    .overlay.visible {
      opacity: 1;
      visibility: visible;
      transform: translateX(0);
      pointer-events: auto;
    }
    .modal {
      position: relative;
      width: 100%;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.2);
      padding: 20px 22px 20px;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      gap: 14px;
      pointer-events: auto;
      max-height: calc(100vh - 48px);
      overflow-y: auto;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
    .status {
      font-size: 13px;
      background: #e2e8f0;
      color: #1e293b;
      padding: 8px 12px;
      border-radius: 10px;
    }
    .status.error {
      background: #fee2e2;
      color: #b91c1c;
    }
    .loading,
    .signed-in,
    .signed-out {
      font-size: 14px;
      line-height: 1.45;
    }
    .actions {
      margin-top: 4px;
      display: flex;
      gap: 8px;
    }
    button {
      font: inherit;
    }
    .btn {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      border-radius: 999px;
      padding: 10px 16px;
      border: 0;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }
    .btn.primary {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #ffffff;
      box-shadow: 0 10px 20px rgba(37, 99, 235, 0.35);
    }
    .btn.primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 14px 24px rgba(37, 99, 235, 0.45);
    }
    .btn.primary:disabled {
      cursor: not-allowed;
      opacity: 0.65;
      transform: none;
      box-shadow: none;
    }
    .close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      background: transparent;
      border: 0;
      color: #475569;
      font-size: 20px;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .close:hover {
      background: rgba(148, 163, 184, 0.18);
      color: #0f172a;
    }
    .close:focus-visible,
    .btn:focus-visible {
      outline: 2px solid #2563eb;
      outline-offset: 2px;
    }
  `;

  shadow.append(style, overlayEl);

  closeBtn.addEventListener("click", hideModal);
  actionBtn.addEventListener("click", () => {
    if (state.loading) return;
    if (state.session) {
      void signOut();
    } else {
      void signIn();
    }
  });

  if (!keyListenerAttached) {
    window.addEventListener("keydown", handleEscape, true);
    keyListenerAttached = true;
  }

  uiReady = true;
  render();
}

function render() {
  if (!uiReady || !overlayEl || !actionBtn || !statusEl || !loadingEl || !signedInEl || !signedOutEl || !emailEl) {
    return;
  }

  const { visible, loading, status, session } = state;
  overlayEl.classList.toggle("visible", visible);
  overlayEl.setAttribute("aria-hidden", visible ? "false" : "true");

  const hasStatus = Boolean(status);
  statusEl.hidden = !hasStatus;
  if (hasStatus && status) {
    statusEl.textContent = status;
    statusEl.classList.toggle("error", status.startsWith("Failed"));
  }

  loadingEl.hidden = !loading;
  signedInEl.hidden = loading || !session;
  signedOutEl.hidden = loading || Boolean(session);

  if (session) emailEl.textContent = session.user?.email ?? "unknown";

  const busy =
    loading ||
    (status !== null && (status.startsWith("Starting") || status.startsWith("Signing")));
  actionBtn.textContent = session ? "Sign out" : "Sign in with Google";
  actionBtn.disabled = busy;
}

function setState(partial: Partial<ModalState>, force = false) {
  Object.assign(state, partial);
  if (!uiReady && !force) return;
  render();
}

function showModal() {
  ensureUi();
  setState({ visible: true });
  void refreshSession();
}

function hideModal() {
  if (!state.visible) return;
  setState({ visible: false });
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === "Escape" && state.visible) {
    event.stopPropagation();
    hideModal();
  }
}

async function refreshSession() {
  setState({ loading: true, status: null });
  try {
    const resp = await sendRuntimeMessage<{ ok: boolean; session: StoredSession | null; error?: string }>({
      type: "GET_AUTH"
    });
    if (!resp?.ok) {
      const message = resp?.error ? `Failed: ${resp.error}` : "Failed: Unable to load session";
      setState({ status: message, loading: false });
      return;
    }
    setState({ session: resp.session ?? null, loading: false, status: null });
  } catch (error) {
    setState({
      status: `Failed: ${error instanceof Error ? error.message : "Unable to load session"}`,
      loading: false
    });
  }
}

async function signIn() {
  setState({ status: "Starting OAuth…", loading: true });
  try {
    const resp = await sendRuntimeMessage<{ ok: boolean; error?: string }>({ type: "OAUTH_START" });
    if (!resp?.ok) {
      setState({ status: `Failed: ${resp?.error ?? "Unknown error"}`, loading: false });
      return;
    }
    setState({ status: "Finishing sign-in…", loading: true });
    void refreshSession();
  } catch (error) {
    setState({ status: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`, loading: false });
  }
}

async function signOut() {
  setState({ status: "Signing out…", loading: true });
  try {
    const resp = await sendRuntimeMessage<{ ok: boolean; error?: string }>({ type: "LOGOUT" });
    if (!resp?.ok) {
      setState({ status: `Failed: ${resp?.error ?? "Unknown error"}`, loading: false });
      return;
    }
    setState({ status: null, loading: false, session: null });
  } catch (error) {
    setState({ status: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`, loading: false });
  }
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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "SHOW_MODAL") {
    showModal();
    if (typeof sendResponse === "function") {
      sendResponse({ ok: true });
    }
  } else if (msg.type === "AUTH_CHANGED") {
    setState({ session: msg.session ?? null, loading: false, status: null });
  }
});
