import { createRoot, type Root } from "react-dom/client";
import { extendTheme } from "@mui/joy/styles";
import createCache from "@emotion/cache";
import { getSidebarStyles } from "./styles.js";

const HOST_ID = "lazyjob-auth-sidebar-host";
const ROOT_ID = "lazyjob-auth-sidebar-root";

export interface ShadowDOMSetup {
  root: Root;
  theme: ReturnType<typeof extendTheme>;
  emotionCache: ReturnType<typeof createCache>;
}

/**
 * Setup shadow DOM with styles and React root
 */
export function setupShadowDOM(): ShadowDOMSetup {
  const host = ensureHost();
  const shadow = host.attachShadow({ mode: "open" });

  // Add custom sidebar styles
  const style = document.createElement("style");
  style.textContent = getSidebarStyles();
  shadow.appendChild(style);

  // Create Emotion cache to inject MUI styles into shadow DOM
  const emotionCache = createCache({
    key: 'lazyjob',
    container: shadow as unknown as HTMLElement,
    prepend: true
  });

  // Create React root
  const container = document.createElement("div");
  container.id = ROOT_ID;
  shadow.appendChild(container);

  const root = createRoot(container);
  const theme = extendTheme({
    fontFamily: {
      body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    },
    cssVarPrefix: 'lazyjob'
  });

  return { root, theme, emotionCache };
}

/**
 * Get or create the host element
 */
function ensureHost(): HTMLDivElement {
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing as HTMLDivElement;

  const host = document.createElement("div");
  host.id = HOST_ID;
  document.documentElement.appendChild(host);
  return host;
}
