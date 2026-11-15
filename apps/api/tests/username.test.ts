import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isUsernameAllowed, USERNAME_MIN, USERNAME_UNAVAILABLE } from "../src/config/username.config.js";
import { registerSchema, staffUsernameField, usernameField } from "../src/features/auth/schemas.js";

// Pure unit tests: no database or Redis needed (the integration tests in the other files need both).

describe("username policy", () => {
  test("names that look like the team are refused, however they are dressed up", () => {
    for (const bad of [
      "admin", "administrator", "the_admin_guy", "admin_01", "admin2024", "4dm1n", "adm1n", "ad_min", "a_d_m_i_n", "adminnn", "sysadmin",
      "staff", "staff2", "st4ff", "talkspace_staff", "developer", "d3veloper", "developer_sam", "dev", "dev123", "dev_sam", "r00t", "root",
      "mod", "m0d", "mod_alex", "moderator", "m0derat0r", "official_ts", "talkspace", "t4lksp4ce", "support", "support_team", "helpdesk",
    ]) {
      assert.equal(isUsernameAllowed(bad), false, `${bad} should be refused`);
    }
  });

  test("foul language and slurs are refused, including the usual disguises", () => {
    for (const bad of ["fuck", "fuuuuck", "fuckyou99", "xx_shit_xx", "sh1t", "b1tch", "bitch_slap", "cunt", "a55", "ass", "ass_man", "cocksucker", "cock", "dick", "dick_boy", "sex", "nazi", "hitler", "adolf_hitler", "pussy_cat", "madarchod", "chutiya"]) {
      assert.equal(isUsernameAllowed(bad), false, `${bad} should be refused`);
    }
  });

  test("ordinary names that merely CONTAIN a blocked fragment are fine (no Scunthorpe problem)", () => {
    for (const ok of [
      "maya_chen", "model_t", "modern_art", "modest_mouse", "devon", "devika", "devotion", "cocktail", "peacock", "analyst", "canal_boat", "janus",
      "grape_juice", "therapist", "nazia", "nazir_khan", "essex_boy", "sussex", "classic", "assistant", "pass_hit", "badminton_fan", "scunthorpe_utd",
      "rustacean", "skywalker", "night_owl", "lantern_77", "space_cadet", "team_rocket", "tester",
    ]) {
      assert.equal(isUsernameAllowed(ok), true, `${ok} should be allowed`);
    }
  });
});

describe("username rules on sign-up and profile edit", () => {
  const parse = (v: string) => usernameField.safeParse(v);

  test(`at least ${USERNAME_MIN} characters, at most 20`, () => {
    assert.equal(parse("ab").success, false);
    assert.equal(parse("abcde").success, false);
    assert.equal(parse("abcdef").success, true);
    assert.equal(parse("a".repeat(20)).success, true);
    assert.equal(parse("a".repeat(21)).success, false);
    assert.match(parse("abcde").error!.issues[0]!.message, /at least 6/);
  });

  test("alphabet is unchanged and case is folded", () => {
    assert.equal(parse("no spaces!").success, false);
    assert.equal(parse("emoji_😀_x").success, false);
    assert.equal(parse("  Maya_Chen ").data, "maya_chen");
  });

  test("a refused word gets one neutral message that does not name the rule", () => {
    for (const word of ["admin_01", "developer7", "fuckyou99", "staff2"]) {
      const r = parse(word);
      assert.equal(r.success, false, word);
      assert.equal(r.error!.issues[0]!.message, USERNAME_UNAVAILABLE);
    }
  });

  test("registration goes through the same rule", () => {
    const base = { name: "X", email: "x@example.test", password: "long-enough-pw", acceptPrivacyPolicy: true };
    assert.equal(registerSchema.safeParse({ ...base, username: "maya_chen" }).success, true);
    assert.equal(registerSchema.safeParse({ ...base, username: "admin" }).success, false);
    assert.equal(registerSchema.safeParse({ ...base, username: "dev_01" }).success, false);
    assert.equal(registerSchema.safeParse({ ...base, username: "abc" }).success, false);
  });

  test("the staff rule lets the team set what the public cannot: reserved words and 2-5 character handles", () => {
    for (const ok of ["admin", "developer", "dev", "staff", "ab", "talkspace", "a".repeat(20)]) {
      assert.equal(staffUsernameField.safeParse(ok).success, true, ok);
    }
    for (const bad of ["a", "", "no spaces", "a".repeat(21), "bad-dash"]) {
      assert.equal(staffUsernameField.safeParse(bad).success, false, bad);
    }
  });
});
