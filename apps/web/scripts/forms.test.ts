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
