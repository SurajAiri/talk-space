import type { AddressInfo } from "node:net";
import { createServer } from "node:http";
import { io as connect, type Socket } from "socket.io-client";

/**
 * Integration tests run against a REAL PostgreSQL and a REAL Redis. They write test
 * users and flush the Redis database below, so point them at disposable instances
 * (defaults match docker-compose.yml; Redis uses database 15 so it can't touch dev data).
 */
process.env.NODE_ENV = "test";
process.env.PORT ??= "0";
process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/app";
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://:redis@localhost:6379/15";
process.env.JWT_SECRET ??= "test-secret-for-local-run-only-0123456789";
process.env.BETTER_AUTH_SECRET ??= "test-better-auth-secret-0123456789abcdef";
process.env.BETTER_AUTH_URL ??= "http://localhost:5173";
process.env.WEB_URL ??= "http://localhost:5173";
process.env.TRUST_PROXY = "1"; // lets tests pretend to be different IPs via X-Forwarded-For
process.env.SEAT_GRACE_SECONDS = "1";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";

const { app } = await import("../src/app.js");
const { createSocketServer } = await import("../src/realtime/socket.js");
const { redis } = await import("../src/lib/redis.js");
const { pool, db } = await import("../src/db/index.js");
const schema = await import("../src/db/schema/index.js");
const { eq } = await import("drizzle-orm");
const { ROOM_CONFIG } = await import("../src/config/rooms.config.js");

await redis.flushdb();

const server = createServer(app);
export const sockets = createSocketServer(server);
await new Promise<void>((r) => server.listen(0, r));
export const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

export { db, schema, eq, redis, ROOM_CONFIG };

export async function stop() {
  for (const s of opened) s.disconnect();
  await sockets.closeAll();
  await Promise.allSettled([pool.end(), redis.quit()]);
}

export async function http<T = any>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string; ip?: string } = {},
): Promise<{ status: number; json: any; headers: Headers; data: T }> {
  const res = await fetch(`${base}/api/v1${path}`, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.ip ? { "X-Forwarded-For": opts.ip } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, headers: res.headers, data: json?.data };
}

let counter = 0;
export const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  token: string;
}

let ipCounter = 10;
export async function makeUser(): Promise<TestUser> {
  const u = uniq();
  const password = "correct-horse-battery";
  const email = `${u}@example.test`;
  const username = `u_${u}`.slice(0, 20);
  const r = await http("/auth/register", {
    body: { name: `User ${u}`, username, email, password, acceptPrivacyPolicy: true },
    ip: `10.0.${ipCounter >> 8}.${ipCounter++ & 255}`,
  });
  if (r.status !== 201) throw new Error(`register failed: ${r.status} ${JSON.stringify(r.json)}`);
  return { id: r.data.user.id, email, username, password, token: r.data.token };
}

const opened = new Set<Socket>();
export function socketFor(token: string): Promise<Socket> {
  const s = connect(base, { path: "/api/v1/realtime", transports: ["websocket"], auth: { token }, reconnection: false });
  opened.add(s);
  return new Promise((resolve, reject) => {
    s.once("connect", () => resolve(s));
    s.once("connect_error", (e) => reject(e));
  });
}

export const emit = <T = any>(s: Socket, ev: string, payload?: unknown): Promise<T> =>
  new Promise((resolve) => (payload === undefined ? s.emit(ev, resolve) : s.emit(ev, payload, resolve)));

/** Resolves with the next `ev` payload, or rejects after `ms`. */
export const next = <T = any>(s: Socket, ev: string, ms = 1500): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out waiting for "${ev}"`)), ms);
    s.once(ev, (p: T) => {
      clearTimeout(t);
      resolve(p);
    });
  });

/** Resolves true if `ev` does NOT arrive within `ms`. */
export const silent = (s: Socket, ev: string, ms = 400): Promise<boolean> =>
  new Promise((resolve) => {
    const h = () => resolve(false);
    s.once(ev, h);
    setTimeout(() => {
      s.off(ev, h);
      resolve(true);
    }, ms);
  });

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function createRoom(token: string, visibility: "public" | "private" = "public") {
  const r = await http("/rooms", {
    token,
    body: {
      title: `Room ${uniq()}`,
      language: "en",
      purpose: "discussion",
      tags: [],
      map: "commons",
      visibility,
    },
  });
  if (r.status !== 201) throw new Error(`createRoom failed: ${r.status} ${JSON.stringify(r.json)}`);
  return r.data as { id: string; joinCode?: string };
}

export const sid = () => `sess_${uniq()}_xxxxxxxx`;
