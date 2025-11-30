import type { StoredSession } from "../lib/supabase";
import type { ApplicationForm } from "../content/scanner/formDetector.js";

// Message types received by background script
export type IncomingMessageType =
	| "OAUTH_START"
	| "GET_AUTH"
	| "LOGOUT"
	| "API_REQUEST"
	| "UPLOAD_FILE"
	| "JD_SCAN";

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

export interface JdScanMessage extends BackgroundMessage {
	type: "JD_SCAN";
	url: string;
	classification: unknown;
	blocks: unknown[];
	applicationForm: ApplicationForm | null;
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
