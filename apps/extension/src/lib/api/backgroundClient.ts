import type { ApiRequestMessage } from "../../background/types.js";

/**
 * Send API requests through the background script to avoid CORS issues
 * Content scripts run in the page context and inherit the page's origin,
 * but background scripts run in the extension context with proper permissions
 */
export async function sendApiRequest<T>(
  method: ApiRequestMessage["method"],
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  console.log("[BackgroundClient] Sending API request:", { method, path, body });
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "API_REQUEST",
        method,
        path,
        body,
        headers,
      } as ApiRequestMessage,
      (response) => {
        console.log("[BackgroundClient] Received response:", response);
        
        if (chrome.runtime.lastError) {
          console.error("[BackgroundClient] Chrome runtime error:", chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response || !response.ok) {
          const errorMsg = response?.error || "API request failed";
          console.error("[BackgroundClient] API request failed:", {
            error: errorMsg,
            response,
            method,
            path
          });
          reject(new Error(errorMsg));
          return;
        }

        console.log("[BackgroundClient] Request successful, data:", response.data);
        resolve(response.data as T);
      }
    );
  });
}
