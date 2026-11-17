import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { appearanceFor } from '../src/world/appearance.ts'
import {
  ACCESSORIES,
  avatarFromId,
  HAIR_COLORS,
  HAIR_STYLES,
  lookFor,
  PANTS_COLORS,
  randomAvatar,
  resolveAvatar,
  sameAvatar,
  sanitizeAvatar,
  SHIRT_COLORS,
  SHIRT_STYLES,
  SKIN_TONES,
} from '../src/world/avatar.ts'
import { EMOTES, emoteById, REACTIONS, reactionById } from '../src/world/fx.ts'
import { emotePose } from '../src/world/render/pose.ts'

const good = { skin: 3, hairStyle: 'mohawk', hairColor: 9, shirtStyle: 'hoodie', shirt: 11, pants: 2, accessory: 'catEars' }

test('the web and the API agree on every list (the server validates what the web draws)', () => {
  const src = readFileSync(new URL('../../api/src/config/avatar.config.ts', import.meta.url), 'utf8')
  const count = (key: string) => Number(new RegExp(`${key}:\\s*(\\d+)`).exec(src)?.[1])
  const names = (key: string) => [...(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`, 's').exec(src)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1])
  assert.equal(count('skin'), SKIN_TONES.length)
  assert.equal(count('hairColor'), HAIR_COLORS.length)
  assert.equal(count('shirt'), SHIRT_COLORS.length)
  assert.equal(count('pants'), PANTS_COLORS.length)
  assert.deepEqual(names('hairStyles'), HAIR_STYLES.map((c) => c.id))
  assert.deepEqual(names('shirtStyles'), SHIRT_STYLES.map((c) => c.id))
  assert.deepEqual(names('accessories'), ACCESSORIES.map((c) => c.id))
})

test('sanitizeAvatar keeps only a complete, in-range character', () => {
  assert.deepEqual(sanitizeAvatar(good), good)
  assert.deepEqual(sanitizeAvatar({ ...good, extra: 'ignored' }), good)
  for (const bad of [null, undefined, 'x', 7, [], {}, { ...good, skin: 10 }, { ...good, skin: -1 }, { ...good, skin: 1.5 }, { ...good, hairStyle: 'rainbow' }, { ...good, accessory: 5 }, { ...good, shirt: '2' }]) {
    assert.equal(sanitizeAvatar(bad), null, JSON.stringify(bad))
  }
})

test('a designed character is drawn as designed; anything invalid falls back to the generated look', () => {
  const look = lookFor('user-1', good)
  assert.deepEqual(look, resolveAvatar(good))
  assert.equal(look.skin, SKIN_TONES[3])
  assert.equal(look.hairStyle, 'mohawk')
  assert.deepEqual(lookFor('user-1', null), appearanceFor('user-1'))
  assert.deepEqual(lookFor('user-1', { ...good, skin: 99 }), appearanceFor('user-1'))
  assert.deepEqual(lookFor('user-1'), appearanceFor('user-1'))
})

test('nobody who has not customised changes: the generated look is exactly what it always was', () => {
  // recorded from the ORIGINAL appearance code, before the designer existed
  const recorded: [string, Record<string, string>][] = [
    ['abc', { skin: '#8d5524', hairColor: '#e2e8f0', hairStyle: 'bob', shirt: '#a855f7', accessory: 'sunhat', pants: '#1e293b' }],
    ['11111111-2222-3333-4444-555555555555', { skin: '#e0a370', hairColor: '#ec4899', hairStyle: 'bun', shirt: '#3b82f6', accessory: 'headphones', pants: '#1e293b' }],
    ['user-42-a1b2', { skin: '#c68642', hairColor: '#1e293b', hairStyle: 'bob', shirt: '#ec4899', accessory: 'crown', pants: '#1e293b' }],
    ['zzzzzzzz', { skin: '#ffdbb5', hairColor: '#451a03', hairStyle: 'long', shirt: '#f59e0b', accessory: 'none', pants: '#1e293b' }],
  ]
  for (const [id, was] of recorded) assert.deepEqual(appearanceFor(id), { ...was, shirtStyle: 'tee' }, id)
})

test('the designer opens on what someone already looks like: the generated look survives a round trip', () => {
  for (let i = 0; i < 300; i++) {
    const id = `user-${i}-${(i * 7919).toString(16)}`
    const g = appearanceFor(id)
    const back = resolveAvatar(avatarFromId(id))
    assert.deepEqual(back, g, id)
    assert.notEqual(sanitizeAvatar(avatarFromId(id)), null, id)
  }
})

test('randomise always makes a valid character, and can reach every option', () => {
  const seen = { hair: new Set<string>(), shirt: new Set<string>(), acc: new Set<string>(), skin: new Set<number>() }
  let s = 12345
  const rng = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296
  for (let i = 0; i < 2000; i++) {
    const a = randomAvatar(rng)
    assert.deepEqual(sanitizeAvatar(a), a)
    seen.hair.add(a.hairStyle)
    seen.shirt.add(a.shirtStyle)
    seen.acc.add(a.accessory)
    seen.skin.add(a.skin)
  }
  assert.equal(seen.hair.size, HAIR_STYLES.length)
  assert.equal(seen.shirt.size, SHIRT_STYLES.length)
  assert.equal(seen.acc.size, ACCESSORIES.length)
  assert.equal(seen.skin.size, SKIN_TONES.length)
  // an rng stuck at 1.0 must still stay in range
  assert.deepEqual(sanitizeAvatar(randomAvatar(() => 0.9999999)), randomAvatar(() => 0.9999999))
  assert.equal(sameAvatar(good, { ...good }), true)
  assert.equal(sameAvatar(good, { ...good, pants: 3 }), false)
  assert.equal(sameAvatar(null, null), true)
  assert.equal(sameAvatar(good, null), false)
})

test('palettes are real colours and have no duplicates (two swatches that look the same would be a mistake)', () => {
  for (const [name, list] of [['skin', SKIN_TONES], ['hair', HAIR_COLORS], ['shirt', SHIRT_COLORS], ['pants', PANTS_COLORS]] as const) {
    assert.ok(list.every((c) => /^#[0-9a-f]{6}$/i.test(c)), `${name}: bad colour`)
    assert.equal(new Set(list.map((c) => c.toLowerCase())).size, list.length, `${name}: duplicate colour`)
  }
})

test('emotes and reactions: unique ids, sensible lengths, and unknown ids are not found', () => {
  assert.equal(new Set(EMOTES.map((e) => e.id)).size, EMOTES.length)
  assert.equal(new Set(REACTIONS.map((r) => r.id)).size, REACTIONS.length)
  assert.ok(EMOTES.every((e) => e.ms >= 1000 && e.ms <= 10_000))
  assert.ok(REACTIONS.some((r) => r.kind === 'emoji') && REACTIONS.some((r) => r.kind === 'text'))
  assert.ok(REACTIONS.filter((r) => r.kind === 'text').every((r) => r.text.length <= 8 && r.text === r.text.toUpperCase()), 'words stay short, so they fit over a head')
  assert.equal(emoteById('dance')?.id, 'dance')
  assert.equal(reactionById('t-gg')?.text, 'GG')
  for (const bad of ['', 'constructor', '__proto__', 'toString', 5, null, undefined]) {
    assert.equal(emoteById(bad), undefined)
    assert.equal(reactionById(bad), undefined)
  }
})

test('every emote has a pose that stays finite, starts and ends at rest, and stops when it is over', () => {
  for (const e of EMOTES) {
    assert.equal(emotePose(e.id, -1), null)
    assert.equal(emotePose(e.id, e.ms + 1), null, `${e.id} should end`)
    const start = emotePose(e.id, 0)!
    assert.ok(Math.abs(start.bob) < 0.01 && Math.abs(start.sway) < 0.01, `${e.id} starts at rest`)
    for (let t = 0; t <= e.ms; t += 37) {
      const p = emotePose(e.id, t)!
      assert.ok(p, `${e.id} at ${t}`)
      for (const v of [p.bob, p.sway, p.tilt, p.armL ?? 0, p.armR ?? 0, p.spin ?? 0]) assert.ok(Number.isFinite(v), `${e.id} at ${t}`)
    }
    const end = emotePose(e.id, e.ms - 1)!
    assert.ok(Math.abs(end.bob) < 0.3 && Math.abs(end.sway) < 0.3, `${e.id} ends at rest`)
  }
  assert.equal(emotePose('nope', 100), null)
  assert.ok(emotePose('spin', 700)!.spin! > 0, 'spin turns')
  assert.equal(emotePose('laugh', 800)!.laugh, true)
  assert.ok(emotePose('cheer', 800)!.armL! > 2, 'cheer raises both arms')
})
