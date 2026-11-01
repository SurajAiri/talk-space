import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { db, eq, http, makeUser, schema, stop, uniq } from "./helpers.ts";

after(stop);

const answers = {
  gender: "non_binary",
  spokenLanguages: ["en"],
  interests: ["Music"],
  skills: ["Listening"],
};

const { PRIVACY_POLICY_VERSION } = await import("../src/config/legal.config.ts");
const { loginWithGoogle } = await import("../src/features/auth/services.ts");

/** What a brand-new Google account looks like: created by `loginWithGoogle`, never shown the policy. */
async function makeGoogleUser() {
  const email = `g-${uniq()}@example.test`;
  const { token, user } = await loginWithGoogle({ email, name: "Gina Google", emailVerified: true });
  return { id: user.id, email, token };
}

const me = async (token: string) => (await http("/users/me", { token })).data;

describe("registering with email", () => {
  test("is refused unless the Privacy Policy is accepted, and no account is created", async () => {
    // a fresh address every time: registering is rate limited per address
    const attempt = (extra: Record<string, unknown>) => {
      const email = `${uniq()}@example.test`;
      return {
        email,
        send: () =>
          http("/auth/register", {
            body: { name: "No Consent", username: `nc_${uniq()}`.slice(0, 20), email, password: "long-enough-pw", ...extra },
            ip: "10.20.0.1",
          }),
      };
    };

    const missing = attempt({});
    const r = await missing.send();
    assert.equal(r.status, 400);
    assert.match(r.json.message, /Privacy Policy/);

    const refused = [missing.email];
    for (const bad of [false, "true", 1, null]) {
      const a = attempt({ acceptPrivacyPolicy: bad });
      assert.equal((await a.send()).status, 400, `acceptPrivacyPolicy=${JSON.stringify(bad)} must not count as accepting`);
      refused.push(a.email);
    }

    for (const email of refused) {
      const login = await http("/auth/login", { body: { email, password: "long-enough-pw" }, ip: "10.20.0.3" });
      assert.equal(login.status, 401, "a refused sign-up must not leave an account behind");
    }
  });

  test("records when, and which version, and does not ask again", async () => {
    const before = Date.now();
    const u = await makeUser();
    const profile = await me(u.token);

    assert.equal(profile.privacyPolicyVersion, PRIVACY_POLICY_VERSION);
    assert.equal(profile.needsPrivacyConsent, false);
    const at = Date.parse(profile.privacyPolicyAcceptedAt);
    assert.ok(Number.isFinite(at), "a real timestamp is stored");
    assert.ok(at >= before - 2000 && at <= Date.now() + 2000, "and it is the moment of sign-up");
  });
});

describe("signing up with Google", () => {
  test("creates an account that has NOT accepted yet, and says it still has to", async () => {
    const g = await makeGoogleUser();
    const profile = await me(g.token);
    assert.equal(profile.privacyPolicyAcceptedAt, null);
    assert.equal(profile.privacyPolicyVersion, null);
    assert.equal(profile.needsPrivacyConsent, true);
    assert.equal(profile.hasPassword, false);
  });

  test("cannot finish onboarding until the policy is accepted", async () => {
    const g = await makeGoogleUser();

    const blocked = await http("/users/me/onboarding", { token: g.token, body: answers });
    assert.equal(blocked.status, 403);
    assert.match(blocked.json.message, /Privacy Policy/);
    assert.equal((await me(g.token)).onboardedAt, null, "nothing was saved");

    const accepted = await http("/users/me/privacy-policy", { token: g.token, body: { accepted: true } });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.needsPrivacyConsent, false);

    const done = await http("/users/me/onboarding", { token: g.token, body: answers });
    assert.equal(done.status, 200);
    assert.ok(done.data.onboardedAt);
  });

  test("an unverified password account claimed through Google does not inherit the pre-registrant's agreement", async () => {
    // someone registers an address they don't own and ticks the box...
    const squatter = await makeUser();
    assert.equal((await me(squatter.token)).needsPrivacyConsent, false);

    // ...then the real owner signs in with Google and takes the account over
    const { token } = await loginWithGoogle({ email: squatter.email, name: "Real Owner", emailVerified: true });
    const profile = await me(token);
    assert.equal(profile.hasPassword, false);
    assert.equal(profile.privacyPolicyAcceptedAt, null);
    assert.equal(profile.needsPrivacyConsent, true);
  });
});

describe("POST /users/me/privacy-policy", () => {
  test("needs a login", async () => {
    assert.equal((await http("/users/me/privacy-policy", { body: { accepted: true } })).status, 401);
  });

  test("only an explicit yes counts", async () => {
    const g = await makeGoogleUser();
    for (const body of [{}, { accepted: false }, { accepted: "true" }, { accepted: 1 }, { acceptPrivacyPolicy: true }]) {
      const r = await http("/users/me/privacy-policy", { token: g.token, body });
      assert.equal(r.status, 400, JSON.stringify(body));
    }
    assert.equal((await me(g.token)).needsPrivacyConsent, true, "still not accepted");
  });

  test("stores the time and version; repeating keeps the first time", async () => {
    const g = await makeGoogleUser();
    const first = await http("/users/me/privacy-policy", { token: g.token, body: { accepted: true } });
    assert.equal(first.status, 200);
    assert.equal(first.data.privacyPolicyVersion, PRIVACY_POLICY_VERSION);
    assert.ok(Number.isFinite(Date.parse(first.data.privacyPolicyAcceptedAt)));

    await new Promise((r) => setTimeout(r, 15));
    const again = await http("/users/me/privacy-policy", { token: g.token, body: { accepted: true } });
    assert.equal(again.status, 200);
    assert.equal(again.data.privacyPolicyAcceptedAt, first.data.privacyPolicyAcceptedAt, "a double click doesn't move it");
  });

  test("a new policy version asks everyone again, and accepting moves the record forward", async () => {
    const u = await makeUser();
    const old = new Date("2020-01-01T00:00:00Z");
    await db
      .update(schema.users)
      .set({ privacyPolicyVersion: "2020-01-01", privacyPolicyAcceptedAt: old })
      .where(eq(schema.users.id, u.id));

    const stale = await me(u.token);
    assert.equal(stale.needsPrivacyConsent, true, "they accepted an older text");
    assert.equal(stale.privacyPolicyVersion, "2020-01-01");

    const r = await http("/users/me/privacy-policy", { token: u.token, body: { accepted: true } });
    assert.equal(r.status, 200);
    assert.equal(r.data.needsPrivacyConsent, false);
    assert.equal(r.data.privacyPolicyVersion, PRIVACY_POLICY_VERSION);
    assert.ok(Date.parse(r.data.privacyPolicyAcceptedAt) > old.getTime(), "a fresh time for the new text");
  });

  test("an account that predates the policy (never accepted) is asked, and can still reach the screen that asks", async () => {
    const u = await makeUser();
    await db
      .update(schema.users)
      .set({ privacyPolicyVersion: null, privacyPolicyAcceptedAt: null })
      .where(eq(schema.users.id, u.id));
    const profile = await me(u.token); // /users/me is never blocked, or the web app couldn't show the prompt
    assert.equal(profile.needsPrivacyConsent, true);
  });
});
