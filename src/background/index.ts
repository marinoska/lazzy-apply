/**
 * Background script entry point
 * Initializes the extension and sets up event listeners
 */
import { bootstrap } from "./auth.js";
import { setupListeners } from "./listeners.js";

// Initialize on startup
bootstrap().catch((error) => {
  console.error("[DynoJob] Bootstrap failed:", error);
});

// Setup Chrome extension listeners
setupListeners();
