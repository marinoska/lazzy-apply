/**
 * Background script entry point
 * Initializes the extension and sets up event listeners
 */
import { bootstrap, setupAuthListener } from "./auth.js";
import { setupListeners } from "./listeners.js";

// Setup auth state listener for token refresh
setupAuthListener();

// Initialize on startup
bootstrap().catch((error) => {
	console.error("[LazyJob] Bootstrap failed:", error);
});

// Setup Chrome extension listeners
setupListeners();
