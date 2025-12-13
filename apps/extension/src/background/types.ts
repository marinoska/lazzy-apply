import type { StoredSession } from "../lib/supabase";

// Message types received by background script
export type IncomingMessageType =
	| "OAUTH_START"
	| "GET_AUTH"
	| "LOGOUT"
	| "API_REQUEST"
	| "UPLOAD_FILE"
	| "JD_SCAN"
	| "GET_LAST_JD";

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
	filename: string;
	contentType: string;
	fileData: string; // base64 encoded
}

export interface DocumentClassification {
	totalParagraphs: number;
	jobDescriptionParagraphs: number;
	paragraphRatio: number;
	sectionRatio: number;
	confidence: number;
	signalDensity: number;
	dominantSignals: string[];
}

export interface JdScanMessage extends BackgroundMessage {
	type: "JD_SCAN";
	url: string;
	jobDescriptionAnalysis: DocumentClassification;
	blocks: unknown[];
}

export interface StoredJD {
	url: string;
	jobDescriptionAnalysis: DocumentClassification;
	blocks: unknown[];
	detectedAt: number;
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
