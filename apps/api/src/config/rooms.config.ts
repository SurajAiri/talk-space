/**
 * Central room configuration. Change values here (or via env) and both the API
 * and the web app pick them up: the web app reads them from GET /api/v1/rooms/config.
 */

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export const ROOM_CONFIG = {
  /** Max participants per room. Snapshotted into each room when it is created. */
  maxMembers: intFromEnv("ROOM_MAX_MEMBERS", 8),

  /** Public room id: letters only, shown upper-case, accepted case-insensitively. */
  idLength: 6,
  /** Private room join code: digits only. */
  joinCodeLength: 6,

  /** A freshly created room is deleted if nobody joins within this window. */
  createJoinWindowSeconds: 120,
  /** After the last member drops (tab closed / network lost) the room survives this long. */
  emptyGraceSeconds: 30,

  /** Wrong join-code guesses allowed per user per room within the window. */
  joinAttemptsPerUser: 5,
  /** Wrong join-code guesses allowed per room (all users together) within the window. */
  joinAttemptsPerRoom: 30,
  joinAttemptWindowSeconds: 600,

  /** Rooms a single user may create within `createWindowSeconds`. */
  createsPerWindow: 5,
  createWindowSeconds: 600,

  title: { min: 3, max: 60 },
  shortDescriptionMax: 160,
  tags: { max: 5, minLength: 2, maxLength: 20 },
  chatMessageMax: 2000,
} as const;

export const PURPOSES = [
  { value: "language_learning", label: "Language learning" },
  { value: "discussion", label: "Topic discussion" },
  { value: "debate", label: "Debate" },
  { value: "explore", label: "Explore new apps & sites" },
  { value: "misc", label: "Miscellaneous" },
] as const;

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ne", label: "Nepali" },
  { value: "hi", label: "Hindi" },
  { value: "bn", label: "Bengali" },
  { value: "ur", label: "Urdu" },
  { value: "ta", label: "Tamil" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "id", label: "Indonesian" },
  { value: "tr", label: "Turkish" },
  { value: "it", label: "Italian" },
] as const;

/**
 * The 2D world every room is held in. The server never needs map geometry:
 * positions travel peer-to-peer, so the server only stores and validates this key.
 * Geometry lives in the web app (apps/web/src/world/maps), keep the keys in sync.
 */
export const MAPS = [
  { value: "commons", label: "Courtyard Commons (café, rec room, studio, campfire)" },
  { value: "beach", label: "Sunset Beach (tiki deck, bonfire, pier)" },
  { value: "market", label: "Sky Night Market (conservatory, tea pavilion)" },
] as const;

export type Purpose = (typeof PURPOSES)[number]["value"];
export type RoomMap = (typeof MAPS)[number]["value"];
export type Visibility = "public" | "private";

/** Rooms stored before maps existed have no map; they are short-lived, so just give them this one. */
export const DEFAULT_LEGACY_MAP: RoomMap = "commons";
export const MAP_VALUES = MAPS.map((m) => m.value) as [RoomMap, ...RoomMap[]];
export const PURPOSE_VALUES = PURPOSES.map((p) => p.value) as [Purpose, ...Purpose[]];
export const LANGUAGE_VALUES = new Set<string>(LANGUAGES.map((l) => l.value));

export const ROOM_ID_REGEX = new RegExp(`^[A-Z]{${ROOM_CONFIG.idLength}}$`);
export const JOIN_CODE_REGEX = new RegExp(`^\\d{${ROOM_CONFIG.joinCodeLength}}$`);

/** What the web app needs to render forms/filters. */
export function publicRoomConfig() {
  return {
    maxMembers: ROOM_CONFIG.maxMembers,
    idLength: ROOM_CONFIG.idLength,
    joinCodeLength: ROOM_CONFIG.joinCodeLength,
    title: ROOM_CONFIG.title,
    shortDescriptionMax: ROOM_CONFIG.shortDescriptionMax,
    tags: ROOM_CONFIG.tags,
    chatMessageMax: ROOM_CONFIG.chatMessageMax,
    purposes: PURPOSES,
    languages: LANGUAGES,
    maps: MAPS,
  };
}
