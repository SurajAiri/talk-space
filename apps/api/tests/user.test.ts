import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { db, eq, http, makeUser, schema, stop, uniq } from "./helpers.ts";

after(stop);

const answers = {
  gender: "non_binary",
  spokenLanguages: ["en", "ne"],
  interests: ["Music", "Hiking"],
  skills: ["Listening"],
};

describe("profile options", () => {
  test("need a login, and describe every list the forms offer", async () => {
    assert.equal((await http("/users/options")).status, 401);

    const u = await makeUser();
    const r = await http("/users/options", { token: u.token });
    assert.equal(r.status, 200);
    assert.equal(r.data.bioMax, 200);
    assert.ok(r.data.genders.some((g: any) => g.value === "prefer_not_to_say"));
    // every room language is also a language people can say they speak
    assert.ok(["en", "ne", "hi"].every((c) => r.data.languages.some((l: any) => l.value === c)));
    assert.ok(r.data.interestSuggestions.length > 5 && r.data.skillSuggestions.length > 5);
  });
});

describe("onboarding", () => {
  test("a new account is not onboarded, and says whether it has a password", async () => {
    const u = await makeUser();
    const me = await http("/users/me", { token: u.token });
    assert.equal(me.data.onboardedAt, null);
    assert.equal(me.data.gender, null);
    assert.equal(me.data.hasPassword, true);
    assert.equal("passwordHash" in me.data, false);
    assert.equal("tokenVersion" in me.data, false);
  });

  test("saves the answers, tidies them, and marks the account onboarded", async () => {
    const u = await makeUser();
    const r = await http("/users/me/onboarding", {
      token: u.token,
      body: {
        ...answers,
        interests: ["Music", "  music  ", "Rock   'n'   roll", "C++"],
        spokenLanguages: ["en", "en", "ne"],
        bio: "  Hello there  ",
      },
    });
    assert.equal(r.status, 200);
    assert.ok(r.data.onboardedAt);
    assert.equal(r.data.gender, "non_binary");
    assert.deepEqual(r.data.spokenLanguages, ["en", "ne"]); // repeats dropped
    assert.deepEqual(r.data.interests, ["Music", "Rock 'n' roll", "C++"]); // case-insensitive repeats dropped, spaces tidied
    assert.equal(r.data.bio, "Hello there");

    const me = await http("/users/me", { token: u.token });
    assert.deepEqual(me.data.skills, ["Listening"]);
  });

  test("the bio is optional", async () => {
    const u = await makeUser();
    const none = await http("/users/me/onboarding", { token: u.token, body: answers });
    assert.equal(none.status, 200);
    assert.equal(none.data.bio, null);
    const blank = await http("/users/me/onboarding", { token: u.token, body: { ...answers, bio: "   " } });
    assert.equal(blank.data.bio, null);
  });

  test("everything else is required, and checked", async () => {
    const u = await makeUser();
    const bad = async (patch: Record<string, unknown>) =>
      (await http("/users/me/onboarding", { token: u.token, body: { ...answers, ...patch } })).status;

    assert.equal(await bad({ gender: undefined }), 400);
    assert.equal(await bad({ gender: "robot" }), 400);
    assert.equal(await bad({ spokenLanguages: [] }), 400);
    assert.equal(await bad({ spokenLanguages: ["en", "xx"] }), 400); // not a language we know
    assert.equal(await bad({ spokenLanguages: ["en", "ne", "hi", "bn", "ur", "ta", "es", "fr", "de"] }), 400); // 9 > 8
    assert.equal(await bad({ interests: [] }), 400);
    assert.equal(await bad({ skills: [] }), 400);
    assert.equal(await bad({ interests: ["x"] }), 400); // too short
    assert.equal(await bad({ interests: ["a".repeat(31)] }), 400); // too long
    assert.equal(await bad({ interests: ["<script>"] }), 400);
    assert.equal(await bad({ bio: "x".repeat(201) }), 400);
    assert.equal(await bad({ bio: "bad\u0000byte" }), 400);

    const me = await http("/users/me", { token: u.token });
    assert.equal(me.data.onboardedAt, null, "nothing was saved by the failed attempts");
  });

  test("repeating it overwrites the answers but keeps the original completion time", async () => {
    const u = await makeUser();
    const first = await http("/users/me/onboarding", { token: u.token, body: answers });
    const again = await http("/users/me/onboarding", { token: u.token, body: { ...answers, gender: "female" } });
    assert.equal(again.status, 200);
    assert.equal(again.data.gender, "female");
    assert.equal(again.data.onboardedAt, first.data.onboardedAt);
  });

  test("needs a login", async () => {
    assert.equal((await http("/users/me/onboarding", { body: answers })).status, 401);
  });
});

describe("editing the profile", () => {
  test("changes only what is sent", async () => {
    const u = await makeUser();
    await http("/users/me/onboarding", { token: u.token, body: { ...answers, bio: "first bio" } });

    const r = await http("/users/me", { method: "PATCH", token: u.token, body: { name: "  New Name ", bio: "second bio" } });
    assert.equal(r.status, 200);
    assert.equal(r.data.name, "New Name");
    assert.equal(r.data.bio, "second bio");
    assert.deepEqual(r.data.spokenLanguages, ["en", "ne"]); // untouched
    assert.equal(r.data.gender, "non_binary");
  });

  test("lists and the bio can be emptied later (only onboarding insists on them)", async () => {
    const u = await makeUser();
    await http("/users/me/onboarding", { token: u.token, body: { ...answers, bio: "something" } });
    const r = await http("/users/me", {
      method: "PATCH",
      token: u.token,
      body: { bio: "", interests: [], skills: [], spokenLanguages: [] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.bio, null);
    assert.deepEqual([r.data.interests, r.data.skills, r.data.spokenLanguages], [[], [], []]);
    assert.ok(r.data.onboardedAt, "still onboarded");
  });

  test("usernames: same rules as sign-up, and unique", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const patch = (token: string, username: string) =>
      http("/users/me", { method: "PATCH", token, body: { username } });

    assert.equal((await patch(a.token, "no spaces!")).status, 400);
    assert.equal((await patch(a.token, "ab")).status, 400);
    assert.equal((await patch(a.token, b.username)).status, 409);
    // changing to your own current name is fine
    assert.equal((await patch(a.token, a.username)).status, 200);

    const fresh = `n_${uniq()}`.slice(0, 20).toLowerCase();
    const ok = await patch(a.token, fresh.toUpperCase()); // stored lower case
    assert.equal(ok.status, 200);
    assert.equal(ok.data.username, fresh);
  });

  test("rejects an empty request, bad values, and ignores fields people may not change", async () => {
    const u = await makeUser();
    const patch = (body: unknown) => http("/users/me", { method: "PATCH", token: u.token, body });

    assert.equal((await patch({})).status, 400);
    assert.equal((await patch({ gender: "robot" })).status, 400);
    assert.equal((await patch({ name: "" })).status, 400);

    // email, role and standing are not editable here: unknown fields are ignored, so nothing is left to update
    assert.equal((await patch({ email: "evil@example.test", userType: "admin", reputationScore: 999 })).status, 400);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    assert.equal(row!.email, u.email);
    assert.equal(row!.userType, "user");
    assert.equal(row!.reputationScore, 0);
  });

  test("needs a login", async () => {
    assert.equal((await http("/users/me", { method: "PATCH", body: { name: "x" } })).status, 401);
  });
});

describe("changing the password", () => {
  const change = (token: string, currentPassword: string, newPassword: string, ip = "10.50.0.1") =>
    http("/auth/change-password", { token, body: { currentPassword, newPassword }, ip });

  test("works, signs out other sessions, and keeps this one signed in", async () => {
    const u = await makeUser();
    const otherDevice = (await http("/auth/login", { body: { email: u.email, password: u.password }, ip: "10.50.1.1" })).data.token;

    const r = await change(u.token, u.password, "a-brand-new-passphrase", "10.50.1.2");
    assert.equal(r.status, 200);
    assert.ok(r.data.token && r.data.token !== u.token);

    // the new token works; every older one (this device's old token, and the other device) is dead
    assert.equal((await http("/users/me", { token: r.data.token })).status, 200);
    assert.equal((await http("/users/me", { token: u.token })).status, 401);
    assert.equal((await http("/users/me", { token: otherDevice })).status, 401);

    // and the credentials really changed
    const oldLogin = await http("/auth/login", { body: { email: u.email, password: u.password }, ip: "10.50.1.3" });
    assert.equal(oldLogin.status, 401);
    const newLogin = await http("/auth/login", { body: { email: u.email, password: "a-brand-new-passphrase" }, ip: "10.50.1.4" });
    assert.equal(newLogin.status, 200);
  });

  test("refuses a wrong current password, an unchanged one, and a weak new one", async () => {
    const u = await makeUser();
    const wrong = await change(u.token, "not-my-password", "a-brand-new-passphrase", "10.50.2.1");
    assert.equal(wrong.status, 400);
    assert.match(wrong.json.message, /current password is incorrect/i);

    const same = await change(u.token, u.password, u.password, "10.50.2.2");
    assert.equal(same.status, 400);

    assert.equal((await change(u.token, u.password, "short", "10.50.2.3")).status, 400);
    assert.equal((await change(u.token, u.password, "a".repeat(73), "10.50.2.4")).status, 400); // bcrypt would ignore the tail
    assert.equal((await change(u.token, "", "a-brand-new-passphrase", "10.50.2.5")).status, 400);

    // nothing changed: the old password and the old token still work
    assert.equal((await http("/users/me", { token: u.token })).status, 200);
    assert.equal((await http("/auth/login", { body: { email: u.email, password: u.password }, ip: "10.50.2.6" })).status, 200);
  });

  test("accounts without a password (Google) have none to change", async () => {
    const u = await makeUser();
    await db.update(schema.users).set({ passwordHash: null }).where(eq(schema.users.id, u.id));

    const me = await http("/users/me", { token: u.token });
    assert.equal(me.data.hasPassword, false);

    const r = await change(u.token, "anything-at-all", "a-brand-new-passphrase", "10.50.3.1");
    assert.equal(r.status, 400);
    assert.match(r.json.message, /google/i);
  });

  test("guessing the current password is rate limited, even with the right one afterwards", async () => {
    const u = await makeUser();
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await change(u.token, `guess-${i}-guess`, "a-brand-new-passphrase", "10.50.4.1")).status);
    assert.deepEqual(statuses.slice(0, 5), Array(5).fill(400));
    assert.ok(statuses.slice(5).every((s) => s === 429), `expected 429 after 5 tries, got ${statuses}`);
    const locked = await change(u.token, u.password, "a-brand-new-passphrase", "10.50.4.2");
    assert.equal(locked.status, 429);
  });

  test("needs a login", async () => {
    const r = await http("/auth/change-password", { body: { currentPassword: "x", newPassword: "a-brand-new-passphrase" }, ip: "10.50.5.1" });
    assert.equal(r.status, 401);
  });
});
