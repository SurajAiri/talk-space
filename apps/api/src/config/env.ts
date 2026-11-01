import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** A required URL, reduced to its origin (no path, no trailing slash) so it compares equal to a browser's Origin header. */
function originOf(name: string): string {
  const value = required(name);
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`${name} must be a full URL such as https://example.com (got "${value}")`);
  }
}

function list(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`);
  return n;
}

function bool(name: string, fallback = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw);
}

const NODE_ENV = process.env.NODE_ENV ?? "development";
const isProd = NODE_ENV === "production";

/** Secrets that must never reach production. */
const PLACEHOLDERS = new Set(["change-me", "change-me-too", "secret", "password", ""]);

function secret(name: string): string {
  const value = required(name);
  if (isProd && (PLACEHOLDERS.has(value) || value.length < 32)) {
    throw new Error(
      `${name} must be a random string of at least 32 characters in production ` +
        `(generate one with: openssl rand -base64 48)`,
    );
  }
  return value;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
if (Boolean(GOOGLE_CLIENT_ID) !== Boolean(GOOGLE_CLIENT_SECRET)) {
  throw new Error("Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.");
}

const TURN_URLS = list(process.env.TURN_URLS ?? "");
const TURN_SECRET = process.env.TURN_SECRET ?? "";
if (TURN_URLS.length > 0) {
  if (!TURN_SECRET) throw new Error("TURN_URLS is set but TURN_SECRET is empty.");
  if (isProd && (PLACEHOLDERS.has(TURN_SECRET) || TURN_SECRET.length < 32)) {
    throw new Error("TURN_SECRET must be a random string of at least 32 characters in production.");
  }
}

const FORCE_RELAY = bool("FORCE_RELAY");
if (FORCE_RELAY && TURN_URLS.length === 0) {
  throw new Error("FORCE_RELAY=true needs TURN_URLS: relay-only connections cannot work without a TURN server.");
}

export const env = {
  NODE_ENV,
  IS_PROD: isProd,
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: secret("JWT_SECRET"),
  /** Short-lived: the web app silently swaps it for a fresh one (POST /auth/refresh). */
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "1h",
  /** Number of reverse proxies in front of the API (0 = none). Needed for correct client IPs. */
  TRUST_PROXY: int("TRUST_PROXY", 0),
  // Google login (better-auth). Optional: leave both empty for email + password only.
  BETTER_AUTH_SECRET: secret("BETTER_AUTH_SECRET"),
  /** Public address of THIS API (Google redirects the browser back to it). */
  BETTER_AUTH_URL: originOf("BETTER_AUTH_URL"),
  /** Address of the web app; the only origin allowed to call this API from a browser. */
  WEB_URL: originOf("WEB_URL"),
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_ENABLED: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
  // Rooms live only in Redis
  REDIS_URL: process.env.REDIS_URL ?? "redis://:redis@localhost:6379",
  // WebRTC ICE servers. STUN is enough for most networks; TURN (a plain relay,
  // NOT an SFU) rescues peers behind symmetric NATs. Leave TURN_* empty to skip it.
  STUN_URLS: list(process.env.STUN_URLS ?? "stun:stun.l.google.com:19302"),
  TURN_URLS,
  TURN_SECRET,
  TURN_TTL_SECONDS: int("TURN_TTL_SECONDS", 3600),
  /**
   * Make every client connect through TURN only, so peers never learn each
   * other's IP addresses. Costs relay bandwidth; recommended for public rooms.
   */
  FORCE_RELAY,
} as const;
