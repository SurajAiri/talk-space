export const ROOM_PURPOSES = [
  "language_learning",
  "discussion",
  "debate",
  "explore",
  "misc",
] as const;
export type RoomPurpose = (typeof ROOM_PURPOSES)[number];

export const ROOM_VISIBILITIES = ["public", "private"] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

// 6 chars, A-Z + 0-9, case-insensitive (always stored/compared in upper case)
export const ROOM_ID_LENGTH = 6;
export const ROOM_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const JOIN_CODE_LENGTH = 6; // digits

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 12; // full-mesh P2P gets heavy past this
export const DEFAULT_MAX_PARTICIPANTS = 6;

// Presence: the client pings /heartbeat every HEARTBEAT_INTERVAL_MS. A member
// not seen for STALE_AFTER_MS is treated as gone (closed tab, lost network).
// This is what makes "room dies when everyone leaves" work without sockets.
// Once the signaling server exists, socket disconnect can replace heartbeats.
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const STALE_AFTER_MS = 60_000;

// Safety net: keys of an untouched room expire on their own.
export const ROOM_IDLE_TTL_MS = 60 * 60 * 1000;

// Wrong join-code guesses allowed per user per room, per window.
export const MAX_CODE_ATTEMPTS = 5;
export const CODE_ATTEMPT_WINDOW_S = 10 * 60;
