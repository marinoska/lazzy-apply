import { apiClient } from "../lib/api/client.js";
import { logout } from "./auth.js";
import { OAUTH_PROVIDER } from "./constants.js";
import { startOAuth } from "./oauth.js";
import { getStoredSession } from "./storage.js";
import type {
	ApiRequestMessage,
	BackgroundMessage,
	MessageResponse,
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

			case "UPLOAD_FILE": {
				const uploadMsg = msg as UploadFileMessage;
				console.log(
					"[MessageHandler] Handling UPLOAD_FILE to:",
					uploadMsg.uploadUrl,
				);
				try {
					const response = await fetch(uploadMsg.uploadUrl, {
						method: "PUT",
						body: uploadMsg.fileData,
						headers: {
							"Content-Type": uploadMsg.contentType,
						},
					});

					if (!response.ok) {
						throw new Error(
							`Upload failed: ${response.status} ${response.statusText}`,
						);
					}

					console.log("[MessageHandler] File upload successful");
					sendResponse({ ok: true });
				} catch (error) {
					console.error("[MessageHandler] File upload failed:", error);
					sendResponse({ ok: false, error: serializeError(error) });
				}
				break;
			}

			default:
				sendResponse({ ok: false, error: serializeError("Unknown message type") });
		}
	} catch (error) {
		console.error("[LazyJob] Message handler error:", error);
		sendResponse({ ok: false, error: serializeError(error) });
	}
}
