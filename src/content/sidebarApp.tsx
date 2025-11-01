import React from "react";
import { createRoot } from "react-dom/client";
import { CssVarsProvider, extendTheme } from "@mui/joy/styles";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Box from "@mui/joy/Box";
import type { StoredSession } from "../lib/supabase";

type SidebarState = {
  visible: boolean;
  loading: boolean;
  status: string | null;
  session: StoredSession | null;
};

type SidebarDeps = {
  fetchSession: () => Promise<StoredSession | null>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

type SidebarModule = {
  show: () => Promise<void>;
  hide: () => void;
  updateSession: (session: StoredSession | null) => void;
  showError: (message: string) => void;
};

const HOST_ID = "dynojob-auth-sidebar-host";

export function createSidebar(deps: SidebarDeps): SidebarModule {
  const state: SidebarState = {
    visible: false,
    loading: false,
    status: null,
    session: null
  };

  const host = ensureHost();
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
    }
    :host *,
    :host *::before,
    :host *::after {
      box-sizing: border-box;
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
    .panel {
      width: 100%;
      background-color: rgba(255, 255, 255, 0.98);
      border-radius: 18px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
      max-height: calc(100vh - 48px);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
  `;

  const container = document.createElement("div");
  container.setAttribute("id", "dynojob-auth-sidebar-root");
  shadow.append(style, container);

  const root = createRoot(container);
  const theme = extendTheme({
    fontFamily: {
      body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }
  });

  const update = (partial: Partial<SidebarState>) => {
    Object.assign(state, partial);
    render();
  };

  const render = () => {
    root.render(
      <CssVarsProvider theme={theme} defaultMode="system">
        <SidebarView
          state={state}
          onClose={hide}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
        />
      </CssVarsProvider>
    );
  };

  const show = async () => {
    update({ visible: true, loading: true, status: null });
    try {
      const session = await deps.fetchSession();
      update({ session, loading: false, status: null });
    } catch (error) {
      update({
        loading: false,
        status: `Failed: ${error instanceof Error ? error.message : "Unable to fetch session"}`
      });
    }
  };

  const hide = () => {
    update({ visible: false });
  };

  const handleSignIn = async () => {
    update({ loading: true, status: "Starting OAuth…" });
    try {
      await deps.signIn();
      update({ status: "Finishing sign-in…" });
      const session = await deps.fetchSession();
      update({ session, loading: false, status: null });
    } catch (error) {
      update({
        loading: false,
        status: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }
  };

  const handleSignOut = async () => {
    update({ loading: true, status: "Signing out…" });
    try {
      await deps.signOut();
      update({ session: null, loading: false, status: null });
    } catch (error) {
      update({
        loading: false,
        status: `Failed: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    }
  };

  const updateSession = (session: StoredSession | null) => {
    update({
      session,
      loading: false,
      status: session ? null : state.status
    });
  };

  const showError = (message: string) => {
    update({ loading: false, status: message });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && state.visible) {
      event.stopPropagation();
      hide();
    }
  };

  window.addEventListener("keydown", onKeyDown, true);
  render();

  return {
    show,
    hide,
    updateSession,
    showError
  };
}

type SidebarViewProps = {
  state: SidebarState;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

function SidebarView({ state, onClose, onSignIn, onSignOut }: SidebarViewProps) {
  const { visible, loading, status, session } = state;

  return (
    <div className={`overlay${visible ? " visible" : ""}`} role="presentation" aria-hidden={visible ? "false" : "true"}>
      <Sheet className="panel" variant="soft" color="neutral">
        <Stack spacing={2} sx={{ p: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography level="title-lg" sx={{ fontWeight: 600 }}>
                DynoJob Login
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ opacity: 0.7 }}>
                Connect with Supabase to manage your DynoJob sessions.
              </Typography>
            </Box>
            <IconButton
              aria-label="Close"
              variant="plain"
              color="neutral"
              size="sm"
              onClick={onClose}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 0 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z"
                  fill="currentColor"
                />
              </svg>
            </IconButton>
          </Stack>

          {status ? (
            <Sheet
              variant="soft"
              color={status.startsWith("Failed") ? "danger" : "neutral"}
              sx={{
                borderRadius: "md",
                px: 1.5,
                py: 1,
                fontSize: "0.875rem"
              }}
            >
              {status}
            </Sheet>
          ) : null}

          {loading ? (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size="sm" determinate={false} />
              <Typography level="body-sm" color="neutral">
                Working…
              </Typography>
            </Stack>
          ) : null}

          {!session && !loading ? (
            <Typography level="body-md" color="neutral">
              You&apos;re not signed in.
            </Typography>
          ) : null}

          {session ? (
            <Sheet variant="plain" sx={{ borderRadius: "md", px: 1.5, py: 1 }}>
              <Typography level="body-sm" color="success" sx={{ fontWeight: 600, mb: 0.5 }}>
                Signed in
              </Typography>
              <Typography level="title-sm">{session.user?.email ?? "unknown"}</Typography>
            </Sheet>
          ) : null}

          <Divider sx={{ my: 0.5 }} />

          <Stack direction="row" spacing={1}>
            <Button
              fullWidth
              variant="solid"
              color="primary"
              size="md"
              onClick={session ? onSignOut : onSignIn}
              disabled={loading}
            >
              {session ? "Sign out" : "Sign in with Google"}
            </Button>
          </Stack>
        </Stack>
      </Sheet>
    </div>
  );
}

function ensureHost() {
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing as HTMLDivElement;
  const host = document.createElement("div");
  host.id = HOST_ID;
  document.documentElement.appendChild(host);
  return host;
}

export default createSidebar;
