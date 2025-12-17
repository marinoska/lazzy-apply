import createCache from "@emotion/cache";
import { extendTheme } from "@mui/joy/styles";
import { createRoot, type Root } from "react-dom/client";
import { getSidebarStyles } from "./styles.js";

const HOST_ID = "lazyjob-auth-sidebar-host";

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
		// Use px instead of rem: Shadow DOM inherits rem from host page's :root, which varies (e.g., LinkedIn uses 10px instead of 16px)
		fontSize: {
			xs: "12px",
			sm: "14px",
			md: "16px",
			lg: "18px",
			xl: "20px",
			xl2: "24px",
			xl3: "30px",
			xl4: "36px",
		},
		components: {
			JoyIconButton: {
				styleOverrides: {
					root: ({ ownerState }) => ({
						// Override rem-based --Icon-fontSize for each size
						...(ownerState.size === "sm" && { "--Icon-fontSize": "20px" }),
						...(ownerState.size === "md" && { "--Icon-fontSize": "24px" }),
						...(ownerState.size === "lg" && { "--Icon-fontSize": "28px" }),
					}),
				},
			},
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
	host.style.pointerEvents = "none";
	document.documentElement.appendChild(host);
	return host;
}
