import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  normalizeTag,
  normalizeUsername,
  passwordStrength,
  validateEmail,
  validateNewPassword,
  validateTag,
  validateUsername,
} from '../src/lib/validation.ts'

test('usernames are cleaned as typed and checked against the same rule as the server', () => {
  assert.equal(normalizeUsername('Maya Chen!'), 'mayachen')
  assert.equal(normalizeUsername('a'.repeat(40)).length, 20)
  assert.equal(validateUsername(''), 'Pick a username')
  assert.equal(validateUsername('ab'), 'At least 3 characters')
  assert.equal(validateUsername('maya_c'), null)
})

test('email check catches typos without rejecting real addresses', () => {
  for (const ok of ['a@b.co', 'first.last+tag@sub.example.org']) assert.equal(validateEmail(ok), null, ok)
  for (const bad of ['', 'maya', 'maya@', 'maya@example', 'ma ya@example.com']) assert.notEqual(validateEmail(bad), null, bad)
})

test('new passwords: 8 characters minimum and at most 72 bytes (multibyte counts as bytes)', () => {
  assert.notEqual(validateNewPassword('short'), null)
  assert.equal(validateNewPassword('longenough'), null)
  assert.notEqual(validateNewPassword('é'.repeat(37)), null) // 74 bytes
  assert.equal(validateNewPassword('é'.repeat(36)), null) // 72 bytes
})

test('password strength rises with length and variety, and common choices stay weak', () => {
  assert.equal(passwordStrength('abc').score, 0)
  assert.equal(passwordStrength('abcdefgh').score, 1)
  assert.equal(passwordStrength('Abcdefgh1').score, 2) // 9 characters with some variety: fair, not good
  assert.ok(passwordStrength('Tr0ub4dor&3x').score >= 3)
  assert.equal(passwordStrength('correct horse battery staple!').score, 4)
  assert.equal(passwordStrength('password1234567890!').score, 1)
})

test('tags are normalised to what the API accepts', () => {
  assert.equal(normalizeTag('  #Rust Lang '), 'rust-lang')
  assert.equal(normalizeTag('C++'), 'c++')
  assert.equal(normalizeTag('héllo!'), 'hllo')
  assert.equal(validateTag('a', 2, 20), 'Tags need at least 2 characters')
  assert.equal(validateTag('ok', 2, 20), null)
})

// ---------------------------------------------------------------- speech bubbles near the screen edge
import { bubbleShift, bubbleVisible } from '../src/world/render/character.ts'

test('a bubble in the middle of the screen is left alone; one at an edge slides inward', () => {
  const screen = { minX: -400, maxX: 400 } // the speaker is at the centre of an 800-wide view
  assert.equal(bubbleShift(200, 1, screen), 0)
  assert.equal(bubbleShift(200, 1, undefined), 0)

  const nearRight = { minX: -740, maxX: 60 } // 60 units from the right edge, bubble is 200 wide (100 each side)
  assert.equal(bubbleShift(200, 1, nearRight), -48, 'pulled left so its right edge sits 8 from the screen edge')
  const nearLeft = { minX: -60, maxX: 740 }
  assert.equal(bubbleShift(200, 1, nearLeft), 48)
})

test('the slide never goes so far that the tail would be outside the bubble', () => {
  const speakerAtTheEdge = { minX: -900, maxX: 0 } // standing right on the edge of the screen
  const shift = bubbleShift(200, 1, speakerAtTheEdge)
  assert.equal(shift, -(100 - 18), 'limited to leave room for the tail')
  assert.ok(Math.abs(shift) < 100)
})

test('the zoom-out scale is accounted for, so the bubble is measured in its own (scaled) units', () => {
  // drawn 1.5x bigger, so each unit of its width covers more of the screen
  assert.equal(bubbleShift(200, 1.5, { minX: -600, maxX: 90 }), bubbleShift(200, 1, { minX: -400, maxX: 60 }))
})

test('someone who is off screen gets no bubble (the message tile covers them), someone on screen does', () => {
  assert.equal(bubbleVisible({ minX: -300, maxX: 300 }), true)
  assert.equal(bubbleVisible(undefined), true)
  assert.equal(bubbleVisible({ minX: -900, maxX: -20 }), false, 'off the left edge')
  assert.equal(bubbleVisible({ minX: 40, maxX: 700 }), false, 'off the right edge')
  assert.equal(bubbleVisible({ minX: -900, maxX: 2 }), false, 'standing right on the edge: still just a fragment')
})
