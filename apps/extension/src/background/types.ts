import type { StoredSession } from "../lib/supabase";

// Message types received by background script
export type IncomingMessageType =
	| "OAUTH_START"
	| "GET_AUTH"
	| "LOGOUT"
	| "API_REQUEST"
	| "UPLOAD_FILE";

export interface BackgroundMessage {
	type: IncomingMessageType;
}

export interface ApiRequestMessage extends BackgroundMessage {
	type: "API_REQUEST";
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	path: string;
	body?: unknown;
	headers?: Record<string, string>;
}

export interface UploadFileMessage extends BackgroundMessage {
	type: "UPLOAD_FILE";
	uploadUrl: string;
	fileData: ArrayBuffer;
	contentType: string;
}

export interface MessageResponse {
	ok: boolean;
	session?: StoredSession | null;
	data?: unknown;
	error?: string;
}

// Message types sent by background script
export type OutgoingMessageType = "AUTH_CHANGED" | "SHOW_MODAL";

export interface AuthChangedMessage {
	type: "AUTH_CHANGED";
	session: StoredSession | null;
}

export interface ShowModalMessage {
	type: "SHOW_MODAL";
}

export type BroadcastMessage = AuthChangedMessage | ShowModalMessage;
