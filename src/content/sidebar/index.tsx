import React from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { CacheProvider } from "@emotion/react";
import type { SidebarState, SidebarDeps, SidebarModule } from "./types.js";
import { SidebarView } from "./SidebarView.js";
import { setupShadowDOM } from "./shadowDOM.js";
import { formatError } from "./utils.js";
import type { StoredSession } from "../../lib/supabase.js";

export type { SidebarModule } from "./types.js";

export function createSidebar(deps: SidebarDeps): SidebarModule {
  const state: SidebarState = {
    visible: false,
    loading: false,
    status: null,
    session: null
  };

  // Setup shadow DOM
  const { root, theme, emotionCache } = setupShadowDOM();

  // State management
  const update = (partial: Partial<SidebarState>): void => {
    Object.assign(state, partial);
    render();
  };

  const render = (): void => {
    root.render(
      <CacheProvider value={emotionCache}>
        <CssVarsProvider 
          theme={theme} 
          defaultMode="system"
        >
          <SidebarView
            state={state}
            onClose={hide}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
          />
        </CssVarsProvider>
      </CacheProvider>
    );
  };

  // Public API
  const show = async (): Promise<void> => {
    update({ visible: true, loading: true, status: null });
    try {
      const session = await deps.fetchSession();
      update({ session, loading: false, status: null });
    } catch (error) {
      update({
        loading: false,
        status: formatError("Failed to fetch session", error)
      });
    }
  };

  const hide = (): void => {
    update({ visible: false });
  };

  // Event handlers
  const handleSignIn = async (): Promise<void> => {
    update({ loading: true, status: "Starting OAuth…" });
    try {
      await deps.signIn();
      update({ status: "Finishing sign-in…" });
      const session = await deps.fetchSession();
      update({ session, loading: false, status: null });
    } catch (error) {
      update({
        loading: false,
        status: formatError("Sign-in failed", error)
      });
    }
  };

  const handleSignOut = async (): Promise<void> => {
    update({ loading: true, status: "Signing out…" });
    try {
      await deps.signOut();
      update({ session: null, loading: false, status: null });
    } catch (error) {
      update({
        loading: false,
        status: formatError("Sign-out failed", error)
      });
    }
  };

  const updateSession = (session: StoredSession | null): void => {
    update({
      session,
      loading: false,
      status: session ? null : state.status
    });
  };

  const showError = (message: string): void => {
    update({ loading: false, status: `Error: ${message}` });
  };

  // Keyboard handler
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && state.visible) {
      event.stopPropagation();
      hide();
    }
  };

  // Setup and initial render
  window.addEventListener("keydown", onKeyDown, true);
  render();

  return {
    show,
    hide,
    updateSession,
    showError
  };
}

export default createSidebar;
