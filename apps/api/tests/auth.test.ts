import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { db, eq, http, makeUser, schema, stop, uniq } from "./helpers.ts";

after(stop);

describe("registration and login", () => {
  test("registers, then logs in; the token works", async () => {
    const u = await makeUser();
    const login = await http("/auth/login", { body: { email: u.email, password: u.password }, ip: "10.1.0.1" });
    assert.equal(login.status, 200);
    const me = await http("/users/me", { token: login.data.token });
    assert.equal(me.status, 200);
    assert.equal(me.data.email, u.email);
  });

  test("rejects weak or oversized passwords and bad usernames", async () => {
    const base = {
      name: "X",
      username: `ok_${uniq()}`.slice(0, 20),
      email: `${uniq()}@example.test`,
      acceptPrivacyPolicy: true,
    };
    const short = await http("/auth/register", { body: { ...base, password: "short" }, ip: "10.1.1.1" });
    assert.equal(short.status, 400);
    // bcrypt would silently ignore everything past 72 bytes
    const long = await http("/auth/register", { body: { ...base, password: "a".repeat(73) }, ip: "10.1.1.2" });
    assert.equal(long.status, 400);
    const badName = await http("/auth/register", {
      body: { ...base, username: "no spaces!", password: "long-enough-pw" },
      ip: "10.1.1.3",
    });
    assert.equal(badName.status, 400);
  });

  test("duplicate email is refused", async () => {
    const u = await makeUser();
    const again = await http("/auth/register", {
      body: {
        name: "Dup",
        username: `d_${uniq()}`.slice(0, 20),
        email: u.email,
        password: "long-enough-pw",
        acceptPrivacyPolicy: true,
      },
      ip: "10.1.2.1",
    });
    assert.equal(again.status, 409);
  });

  test("wrong password and unknown email give the same answer", async () => {
    const u = await makeUser();
    const wrong = await http("/auth/login", { body: { email: u.email, password: "wrong-password" }, ip: "10.1.3.1" });
    const unknown = await http("/auth/login", {
      body: { email: `nobody-${uniq()}@example.test`, password: "wrong-password" },
      ip: "10.1.3.2",
    });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.json.message, unknown.json.message);
  });

  test("login is rate limited per account, even from many different IPs", async () => {
    const u = await makeUser();
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      // a botnet: every attempt from a new address
      const r = await http("/auth/login", { body: { email: u.email, password: `guess-${i}-xxxx` }, ip: `10.2.0.${i + 1}` });
      results.push(r.status);
    }
    assert.deepEqual(results.slice(0, 8), Array(8).fill(401));
    assert.ok(results.slice(8).every((s) => s === 429), `expected 429 after 8 tries, got ${results}`);
    // and the right password is also refused while locked out
    const locked = await http("/auth/login", { body: { email: u.email, password: u.password }, ip: "10.2.0.99" });
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers.get("retry-after")) > 0);
  });

  test("login is rate limited per IP across accounts", async () => {
    let tooMany = 0;
    for (let i = 0; i < 40; i++) {
      const r = await http("/auth/login", {
        body: { email: `spray-${uniq()}@example.test`, password: "password-guess" },
        ip: "10.3.0.1",
      });
      if (r.status === 429) tooMany++;
    }
    assert.ok(tooMany >= 8, `expected the IP to be limited, only ${tooMany} were`);
  });
});

describe("tokens and sessions", () => {
  test("a banned user's still-valid token stops working at once", async () => {
    const u = await makeUser();
    assert.equal((await http("/users/me", { token: u.token })).status, 200);
    await db.update(schema.users).set({ status: "banned" }).where(eq(schema.users.id, u.id));
    const r = await http("/rooms/config", { token: u.token });
    assert.equal(r.status, 403);
  });

  test("role comes from the database, not the token", async () => {
    const u = await makeUser();
    assert.equal((await http("/admin/reports", { token: u.token })).status, 403);
    await db.update(schema.users).set({ userType: "admin" }).where(eq(schema.users.id, u.id));
    assert.equal((await http("/admin/reports", { token: u.token })).status, 200);
    await db.update(schema.users).set({ userType: "user" }).where(eq(schema.users.id, u.id));
    assert.equal((await http("/admin/reports", { token: u.token })).status, 403); // demoted: same token, no access
  });

  test("refresh returns a working token; log out everywhere kills them all", async () => {
    const u = await makeUser();
    const r = await http("/auth/refresh", { method: "POST", body: {}, token: u.token });
    assert.equal(r.status, 200);
    assert.equal((await http("/users/me", { token: r.data.token })).status, 200);

    assert.equal((await http("/auth/logout-everywhere", { method: "POST", body: {}, token: u.token })).status, 200);
    assert.equal((await http("/users/me", { token: u.token })).status, 401);
    assert.equal((await http("/users/me", { token: r.data.token })).status, 401);
    // logging in again gives a token for the new generation
    const again = await http("/auth/login", { body: { email: u.email, password: u.password }, ip: "10.4.0.1" });
    assert.equal((await http("/users/me", { token: again.data.token })).status, 200);
  });

  test("garbage and unsigned tokens are rejected", async () => {
    assert.equal((await http("/users/me", { token: "not.a.token" })).status, 401);
    // alg:none token
    const none =
      Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url") +
      "." +
      Buffer.from('{"id":"00000000-0000-0000-0000-000000000000","tv":0}').toString("base64url") +
      ".";
    assert.equal((await http("/users/me", { token: none })).status, 401);
  });
});

describe("Google sign-in cannot be used to take over an account", () => {
  test("pre-registered unverified account: the real owner takes it over and the attacker is locked out", async () => {
    const { loginWithGoogle } = await import("../src/features/auth/services.ts");
    const victim = await makeUser(); // the "attacker" registers the victim's address with a password they know
    const before = await http("/users/me", { token: victim.token });
    assert.equal(before.status, 200);

    const res = await loginWithGoogle({ email: victim.email, name: "Real Owner", emailVerified: true });
    assert.equal(res.user.id, victim.id);

    // attacker's old token and password are both dead
    assert.equal((await http("/users/me", { token: victim.token })).status, 401);
    const pw = await http("/auth/login", { body: { email: victim.email, password: victim.password }, ip: "10.5.0.1" });
    assert.equal(pw.status, 401);
    // the owner's new token works
    assert.equal((await http("/users/me", { token: res.token })).status, 200);
  });

  test("an unverified Google address is refused", async () => {
    const { loginWithGoogle } = await import("../src/features/auth/services.ts");
    const victim = await makeUser();
    await assert.rejects(
      loginWithGoogle({ email: victim.email, name: "X", emailVerified: false }),
      /not verified/,
    );
    // nothing changed for the existing account
    assert.equal((await http("/users/me", { token: victim.token })).status, 200);
  });

  test("a new Google user is created as verified; a second sign-in keeps the same account and token generation", async () => {
    const { loginWithGoogle } = await import("../src/features/auth/services.ts");
    const email = `g-${uniq()}@example.test`;
    const first = await loginWithGoogle({ email, name: "Gee", emailVerified: true });
    const second = await loginWithGoogle({ email, name: "Gee", emailVerified: true });
    assert.equal(first.user.id, second.user.id);
    assert.equal((await http("/users/me", { token: first.token })).status, 200); // not revoked by the second sign-in
  });
});

describe("hardening", () => {
  test("security headers are set and the framework is not advertised", async () => {
    const r = await http("/health");
    assert.equal(r.headers.get("x-powered-by"), null);
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  });

  test("other origins get no CORS permission", async () => {
    const res = await fetch(`${(await import("./helpers.ts")).base}/api/v1/health`, { headers: { Origin: "https://evil.example" } });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });

  test("the web app's origin is allowed, including the preflight", async () => {
    const { base } = await import("./helpers.ts");
    const origin = process.env.WEB_URL!;
    const res = await fetch(`${base}/api/v1/health`, { headers: { Origin: origin } });
    assert.equal(res.headers.get("access-control-allow-origin"), origin);
    assert.equal(res.headers.get("access-control-allow-credentials"), "true");

    const pre = await fetch(`${base}/api/v1/auth/login`, {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,authorization" },
    });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("access-control-allow-origin"), origin);
    assert.match(pre.headers.get("access-control-allow-headers") ?? "", /Authorization/);
  });

  test("oversized JSON bodies are refused", async () => {
    const r = await http("/auth/login", { body: { email: "a@b.co", password: "x".repeat(40_000) }, ip: "10.6.0.1" });
    assert.equal(r.status, 413);
    const bad = await fetch(`${(await import("./helpers.ts")).base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "10.6.0.2" },
      body: "{not json",
    });
    assert.equal(bad.status, 400);
  });

  test("provider list reflects configuration", async () => {
    const r = await http("/auth/providers");
    assert.deepEqual(r.data, { google: false });
  });
});
