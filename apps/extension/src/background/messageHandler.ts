import { apiClient } from "../lib/api/client.js";
import { logout } from "./auth.js";
import { OAUTH_PROVIDER } from "./constants.js";
import { startOAuth } from "./oauth.js";
import { getStoredSession } from "./storage.js";
import type {
	ApiRequestMessage,
	BackgroundMessage,
	JdScanMessage,
	MessageResponse,
	ShowModalMessage,
	UploadFileMessage,
} from "./types.js";

/**
 * Serialize error to a meaningful string message
 */
function serializeError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	if (error && typeof error === "object") {
		// Try to extract message from error object
		if ("message" in error && typeof error.message === "string") {
			return error.message;
		}
		// Fallback to JSON stringify for objects
		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}
	return String(error);
}

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
	sender: chrome.runtime.MessageSender,
	sendResponse: (response: MessageResponse) => void,
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

			case "API_REQUEST": {
				const apiMsg = msg as ApiRequestMessage;
				console.log("[MessageHandler] Handling API_REQUEST:", apiMsg);
				try {
					let data: unknown;
					switch (apiMsg.method) {
						case "GET":
							data = await apiClient.get(apiMsg.path, {
								params: apiMsg.body as object,
								headers: apiMsg.headers,
							});
							break;
						case "POST":
							data = await apiClient.post(apiMsg.path, {
								body: apiMsg.body as object | BodyInit,
								headers: apiMsg.headers,
							});
							break;
						case "PUT":
							data = await apiClient.put(apiMsg.path, {
								body: apiMsg.body,
								headers: apiMsg.headers,
							} as RequestInit);
							break;
						case "PATCH":
							data = await apiClient.patch(apiMsg.path, {
								body: apiMsg.body,
								headers: apiMsg.headers,
							} as RequestInit);
							break;
						case "DELETE":
							data = await apiClient.doDelete(apiMsg.path);
							break;
						default:
							throw new Error(`Unsupported method: ${apiMsg.method}`);
					}
					console.log("[MessageHandler] API request successful, data:", data);
					sendResponse({ ok: true, data });
				} catch (error) {
					console.error("[MessageHandler] API request failed:", error);
					sendResponse({ ok: false, error: serializeError(error) });
				}
				break;
			}

			case "JD_SCAN": {
				const scanMsg = msg as JdScanMessage;
				console.log("[MessageHandler] Handling JD_SCAN:", scanMsg);

				// Check if an application form was detected
				if (scanMsg.applicationForm?.formDetected) {
					console.log(
						"[MessageHandler] Application form detected, showing sidebar",
					);

					// Send SHOW_MODAL message to the tab that sent the scan
					if (sender.tab?.id) {
						const showModalMsg: ShowModalMessage = { type: "SHOW_MODAL" };
						chrome.tabs.sendMessage(sender.tab.id, showModalMsg, () => {
							const error = chrome.runtime.lastError;
							if (error) {
								console.warn(
									"[MessageHandler] Failed to show sidebar:",
									error.message,
								);
							}
						});
					}
				}

				sendResponse({ ok: true });
				break;
			}

			case "UPLOAD_FILE": {
				const uploadMsg = msg as UploadFileMessage;
				console.log("[MessageHandler] Handling UPLOAD_FILE:", {
					filename: uploadMsg.filename,
					contentType: uploadMsg.contentType,
					size: uploadMsg.fileData.byteLength,
				});

				try {
					// Get upload URL and secret from environment
					const uploadUrl = import.meta.env.VITE_UPLOAD_URL as
						| string
						| undefined;
					if (!uploadUrl) {
						throw new Error("VITE_UPLOAD_URL is not configured");
					}

					// SECURITY: VITE_EXTENSION_SECRET must ONLY be used in the background script.
					// Background scripts run in an isolated context inaccessible to web pages.
					// Never import or use this secret in content scripts or UI components.
					const extensionSecret = import.meta.env.VITE_EXTENSION_SECRET as
						| string
						| undefined;
					if (!extensionSecret) {
						throw new Error("VITE_EXTENSION_SECRET is not configured");
					}

					// Get user session for authentication
					const session = await getStoredSession();
					if (!session?.user) {
						throw new Error("User not authenticated");
					}

					// Upload directly to Edge Function
					const response = await fetch(`${uploadUrl}/upload`, {
						method: "POST",
						headers: {
							"Content-Type": uploadMsg.contentType,
							"X-Upload-Filename": uploadMsg.filename,
							"X-User-Id": session.user.id,
							"X-User-Email": session.user.email ?? "",
							"X-Extension-Key": extensionSecret,
						},
						body: uploadMsg.fileData,
					});

					if (!response.ok) {
						const errorData = await response
							.json()
							.catch(() => ({ error: response.statusText }));
						throw new Error(
							(errorData as { error?: string }).error ??
								`Upload failed: ${response.status}`,
						);
					}

					const data = await response.json();
					console.log("[MessageHandler] Upload successful:", data);
					sendResponse({ ok: true, data });
				} catch (error) {
					console.error("[MessageHandler] Upload failed:", error);
					sendResponse({ ok: false, error: serializeError(error) });
				}
				break;
			}

			default:
				sendResponse({
					ok: false,
					error: serializeError("Unknown message type"),
				});
		}
	} catch (error) {
		console.error("[LazyJob] Message handler error:", error);
		sendResponse({ ok: false, error: serializeError(error) });
	}
}
