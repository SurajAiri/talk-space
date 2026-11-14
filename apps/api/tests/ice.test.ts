import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

// ice.service imports env.ts, which validates these at import time. No DB/Redis needed here.
process.env.DATABASE_URL ??= "postgres://x:x@localhost:5432/x";
process.env.JWT_SECRET ??= "test-secret-for-local-run-only-0123456789";
process.env.BETTER_AUTH_SECRET ??= "test-better-auth-secret-0123456789abcdef";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.WEB_URLS ??= "http://localhost:5173";

const { buildIceServers } = await import("../src/services/ice.service.js");

const base = {
  STUN_URLS: ["stun:stun.example.com:19302"],
  TURN_URLS: [] as string[],
  TURN_SECRET: "",
  TURN_USERNAME: "",
  TURN_CREDENTIAL: "",
  TURN_TTL_SECONDS: 3600,
};
const TURN = [
  "turn:relay.example.com:3478?transport=udp",
  "turn:relay.example.com:3478?transport=tcp",
  "turns:relay.example.com:443?transport=tcp",
];

test("no TURN configured: STUN only", () => {
  assert.deepEqual(buildIceServers("u1", base), [{ urls: base.STUN_URLS }]);
});

test("static login: provider credentials are passed through unchanged", () => {
  const out = buildIceServers("u1", {
    ...base,
    TURN_URLS: TURN,
    TURN_USERNAME: "provider-user",
    TURN_CREDENTIAL: "provider-pass",
  });
  assert.equal(out.length, 2);
  assert.deepEqual(out[1], { urls: TURN, username: "provider-user", credential: "provider-pass" });
});

test("shared secret: per-user, expiring credential (coturn REST scheme)", () => {
  const now = 1_700_000_000_000;
  const out = buildIceServers("user-42", { ...base, TURN_URLS: TURN, TURN_SECRET: "s".repeat(40) }, now);
  const expiry = Math.floor(now / 1000) + 3600;
  const username = `${expiry}:user-42`;
  assert.deepEqual(out[1], {
    urls: TURN,
    username,
    credential: createHmac("sha1", "s".repeat(40)).update(username).digest("base64"),
  });
});

test("TURN_URLS without any credential: no half-configured TURN entry is emitted", () => {
  const out = buildIceServers("u1", { ...base, TURN_URLS: TURN });
  assert.deepEqual(out, [{ urls: base.STUN_URLS }]);
});

test("the returned lists are copies, not the config's own arrays", () => {
  const out = buildIceServers("u1", { ...base, TURN_URLS: TURN, TURN_USERNAME: "a", TURN_CREDENTIAL: "b" });
  out[1]!.urls.push("turn:evil");
  assert.equal(TURN.length, 3);
});
