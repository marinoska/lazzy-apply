import type { StoredSession } from "../lib/supabase";

// Message types received by background script
export type IncomingMessageType = "OAUTH_START" | "GET_AUTH" | "LOGOUT";

export interface BackgroundMessage {
  type: IncomingMessageType;
}

export interface MessageResponse {
  ok: boolean;
  session?: StoredSession | null;
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
