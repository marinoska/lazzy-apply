import createCache from "@emotion/cache";
import { extendTheme } from "@mui/joy/styles";
import { type Root, createRoot } from "react-dom/client";
import { getSidebarStyles } from "./styles.js";

const HOST_ID = "lazyjob-auth-sidebar-host";
const ROOT_ID = "lazyjob-auth-sidebar-root";

export interface ShadowDOMSetup {
	root: Root;
	theme: ReturnType<typeof extendTheme>;
	emotionCache: ReturnType<typeof createCache>;
	shadowRootElement: HTMLDivElement;
}

/**
 * Setup shadow DOM with styles and React root
 */
export function setupShadowDOM(): ShadowDOMSetup {
	const host = ensureHost();
	const shadowContainer = host.attachShadow({ mode: "open" });

	// Add custom sidebar styles FIRST (before Emotion cache)
	const customStyle = document.createElement("style");
	customStyle.textContent = getSidebarStyles();
	shadowContainer.appendChild(customStyle);

	// Create shadow root element for React
	const shadowRootElement = document.createElement("div");
	shadowContainer.appendChild(shadowRootElement);

	// Create Emotion cache with prepend: true so Joy UI styles come AFTER custom styles
	const emotionCache = createCache({
		key: "css",
		prepend: true,
		container: shadowContainer,
	});

	const root = createRoot(shadowRootElement);

	// Configure theme for shadow DOM
	const theme = extendTheme({
		fontFamily: {
			body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			display:
				'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
		},
	});

	return { root, theme, emotionCache, shadowRootElement };
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
