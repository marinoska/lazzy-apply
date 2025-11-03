import type { BackgroundMessage, MessageResponse } from "./types.js";
import { OAUTH_PROVIDER } from "./constants.js";
import { startOAuth } from "./oauth.js";
import { logout } from "./auth.js";
import { getStoredSession } from "./storage.js";

/**
 * Type guard for message validation
 */
export function isValidMessage(msg: unknown): msg is BackgroundMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "type" in msg &&
    typeof (msg as BackgroundMessage).type === "string"
  );
}

/**
 * Route messages to appropriate handlers
 */
export async function handleMessage(
  msg: BackgroundMessage,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    switch (msg.type) {
      case "OAUTH_START":
        await startOAuth(OAUTH_PROVIDER);
        sendResponse({ ok: true });
        break;

      case "GET_AUTH":
        sendResponse({ ok: true, session: await getStoredSession() });
        break;

      case "LOGOUT":
        await logout();
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  } catch (error) {
    console.error("[DynoJob] Message handler error:", error);
    sendResponse({ ok: false, error: String(error) });
  }
}
