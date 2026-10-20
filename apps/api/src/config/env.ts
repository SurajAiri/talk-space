import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function list(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3000),
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  // Google login (better-auth)
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
  WEB_URL: required("WEB_URL"),
  GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET"),
  // Rooms live only in Redis
  REDIS_URL: process.env.REDIS_URL ?? "redis://:redis@localhost:6379",
  // WebRTC ICE servers. STUN is enough for most networks; TURN (a plain relay,
  // NOT an SFU) rescues peers behind symmetric NATs. Leave TURN_* empty to skip it.
  STUN_URLS: list(process.env.STUN_URLS ?? "stun:stun.l.google.com:19302"),
  TURN_URLS: list(process.env.TURN_URLS ?? ""),
  TURN_SECRET: process.env.TURN_SECRET ?? "",
  TURN_TTL_SECONDS: Number(process.env.TURN_TTL_SECONDS ?? 3600),
} as const;
