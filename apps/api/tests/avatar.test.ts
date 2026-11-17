import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AVATAR_CONFIG } from "../src/config/avatar.config.js";

// Pure unit tests: no database, Redis or environment needed.
import { avatarSchema } from "../src/features/user/avatar.schema.js";

const good = { skin: 3, hairStyle: "mohawk", hairColor: 9, shirtStyle: "hoodie", shirt: 11, pants: 2, accessory: "catEars" };

describe("avatar rules", () => {
  test("a complete, in-range character is accepted", () => {
    assert.deepEqual(avatarSchema.parse(good), good);
  });

  test("the first and last choice of every list are accepted, one past the end is not", () => {
    const last = {
      skin: AVATAR_CONFIG.skin - 1,
      hairColor: AVATAR_CONFIG.hairColor - 1,
      shirt: AVATAR_CONFIG.shirt - 1,
      pants: AVATAR_CONFIG.pants - 1,
      hairStyle: AVATAR_CONFIG.hairStyles.at(-1)!,
      shirtStyle: AVATAR_CONFIG.shirtStyles.at(-1)!,
      accessory: AVATAR_CONFIG.accessories.at(-1)!,
    };
    assert.equal(avatarSchema.safeParse(last).success, true);
    assert.equal(avatarSchema.safeParse({ ...good, skin: 0, pants: 0, shirt: 0, hairColor: 0 }).success, true);
    for (const key of ["skin", "hairColor", "shirt", "pants"] as const) {
      assert.equal(avatarSchema.safeParse({ ...good, [key]: AVATAR_CONFIG[key] }).success, false, `${key} one past the end`);
      assert.equal(avatarSchema.safeParse({ ...good, [key]: -1 }).success, false, `${key} negative`);
      assert.equal(avatarSchema.safeParse({ ...good, [key]: 1.5 }).success, false, `${key} fractional`);
      assert.equal(avatarSchema.safeParse({ ...good, [key]: "2" }).success, false, `${key} as text`);
    }
  });

  test("styles must be one of the known names; nothing else can be smuggled in", () => {
    for (const bad of [
      { hairStyle: "afro2" },
      { shirtStyle: "<script>" },
      { accessory: "jetpack" },
      { accessory: "" },
      { skin: null },
    ]) {
      assert.equal(avatarSchema.safeParse({ ...good, ...bad }).success, false, JSON.stringify(bad));
    }
    assert.equal(avatarSchema.safeParse({ ...good, color: "#ff0000" }).success, false, "extra fields are refused");
    const { skin: _skin, ...incomplete } = good;
    assert.equal(avatarSchema.safeParse(incomplete).success, false, "every field is required");
    assert.equal(avatarSchema.safeParse("nope").success, false);
  });
});
