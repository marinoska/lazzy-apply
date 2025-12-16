import type { StoredSession } from "../lib/supabase.js";
import { formStore } from "./scanner/FormStoreManager.js";
import { NavigationWatcher } from "./scanner/navigationWatcher.js";
import { scanPage } from "./scanner/scanner.js";
import createSidebar, { type SidebarModule } from "./sidebar/index.js";

/**
 * Check if we're in an iframe - if so, only run form detection, not sidebar
 */

type MessageType = "SHOW_MODAL" | "AUTH_CHANGED";

interface BaseMessage {
	type: MessageType;
}

interface ShowModalMessage extends BaseMessage {
	type: "SHOW_MODAL";
}

interface AuthChangedMessage extends BaseMessage {
	type: "AUTH_CHANGED";
	session: StoredSession | null;
}

type ContentMessage = ShowModalMessage | AuthChangedMessage;

interface MessageResponse {
	ok: boolean;
	error?: string;
}

let sidebar: SidebarModule | null = null;

/**
 * Handle messages from the background script
 * Only handle sidebar-related messages in the parent frame
 */
if (formStore.isParent) {
	chrome.runtime.onMessage.addListener(
		(
			msg: BaseMessage,
			_sender: chrome.runtime.MessageSender,
			sendResponse: (response: MessageResponse) => void,
		) => {
			if (!isValidMessage(msg)) return false;

			switch (msg.type) {
				case "SHOW_MODAL":
					handleShowModal(sendResponse);
					return true; // Keep channel open for async response

				case "AUTH_CHANGED":
					handleAuthChanged(msg.session);
					return false;

				default:
					return false;
			}
		},
	);
}

/**
 * Type guard to validate incoming messages
 */
function isValidMessage(msg: unknown): msg is ContentMessage {
	return (
		typeof msg === "object" &&
		msg !== null &&
		"type" in msg &&
		typeof (msg as BaseMessage).type === "string"
	);
}

/**
 * Handle SHOW_MODAL message
 */
async function handleShowModal(
	sendResponse: (response: MessageResponse) => void,
): Promise<void> {
	try {
		const sidebarInstance = ensureSidebar();
		await sidebarInstance.show();
		sendResponse({ ok: true });
	} catch (error) {
		console.error("[LazyJob] Failed to open sidebar:", error);
		sendResponse({ ok: false, error: String(error) });
	}
}

/**
 * Handle AUTH_CHANGED message
 */
function handleAuthChanged(session: StoredSession | null): void {
	if (sidebar) {
		sidebar.updateSession(session);
	}
}

/**
 * Lazy-initialize the sidebar
 */
function ensureSidebar(): SidebarModule {
	if (!sidebar) {
		sidebar = createSidebar({
			fetchSession,
			signIn,
			signOut,
		});
	}
	return sidebar;
}

// Message types sent to background script
interface GetAuthMessage {
	type: "GET_AUTH";
}

interface OAuthStartMessage {
	type: "OAUTH_START";
}

interface LogoutMessage {
	type: "LOGOUT";
}

type BackgroundMessage = GetAuthMessage | OAuthStartMessage | LogoutMessage;

// Response types from background script
interface BackgroundResponse {
	ok: boolean;
	session?: StoredSession | null;
	error?: string;
}

/**
 * Fetch the current session from the background script
 */
async function fetchSession(): Promise<StoredSession | null> {
	const message: GetAuthMessage = { type: "GET_AUTH" };
	const response = await sendRuntimeMessage<BackgroundResponse>(message);

	if (!response?.ok) {
		throw new Error(response?.error ?? "Unable to fetch session");
	}

	return response.session ?? null;
}

/**
 * Initiate OAuth sign-in flow
 */
async function signIn(): Promise<void> {
	const message: OAuthStartMessage = { type: "OAUTH_START" };
	const response = await sendRuntimeMessage<BackgroundResponse>(message);

	if (!response?.ok) {
		throw new Error(response?.error ?? "Sign-in failed");
	}
}

/**
 * Sign out the current user
 */
async function signOut(): Promise<void> {
	const message: LogoutMessage = { type: "LOGOUT" };
	const response = await sendRuntimeMessage<BackgroundResponse>(message);

	if (!response?.ok) {
		throw new Error(response?.error ?? "Sign-out failed");
	}
}

/**
 * Send a message to the background script and wait for response
 */
function sendRuntimeMessage<T>(message: BackgroundMessage): Promise<T> {
	return new Promise((resolve, reject) => {
		try {
			chrome.runtime.sendMessage(message, (response: T) => {
				const error = chrome.runtime.lastError;

				if (error) {
					// Check for extension context invalidation
					if (error.message?.includes("Extension context invalidated")) {
						reject(
							new Error("Extension was reloaded. Please refresh the page."),
						);
						return;
					}
					reject(new Error(error.message));
					return;
				}

				resolve(response);
			});
		} catch (error) {
			// Catch synchronous errors (e.g., extension context invalidated)
			if (
				error instanceof Error &&
				error.message.includes("Extension context invalidated")
			) {
				reject(new Error("Extension was reloaded. Please refresh the page."));
				return;
			}
			reject(error);
		}
	});
}

/**
 * Initialize page scanner with navigation detection
 * Only run full scanner in parent frame or iframes with forms
 * Show sidebar automatically when an application form is detected
 */
new NavigationWatcher(() => {
	const applicationForm = scanPage();

	// Auto-show sidebar when form detected in parent frame
	if (formStore.isParent && applicationForm?.formDetected) {
		const sidebarInstance = ensureSidebar();
		sidebarInstance.show();
	}
});
