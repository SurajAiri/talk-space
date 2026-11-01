import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  normalizeLabel,
  sameList,
  validateBio,
  validateConfirmation,
  validateLabel,
} from '../src/lib/validation.ts'

test('interests and skills are tidied like the server does, then checked against the same rule', () => {
  assert.equal(normalizeLabel('  rock    climbing '), 'rock climbing')
  assert.equal(validateLabel('Music', 2, 30), null)
  for (const ok of ['C++', 'R&B', "Rock 'n' roll", 'Café culture', '日本語', 'Web 3.0']) assert.equal(validateLabel(ok, 2, 30), null, ok)
  assert.notEqual(validateLabel('a', 2, 30), null) // too short
  assert.notEqual(validateLabel('a'.repeat(31), 2, 30), null) // too long
  for (const bad of ['<script>', '-leading', '🔥🔥', 'semi;colon']) assert.notEqual(validateLabel(bad, 2, 30), null, bad)
})

test('the bio limit counts what will be stored (trimmed)', () => {
  assert.equal(validateBio('', 200), null)
  assert.equal(validateBio('x'.repeat(200), 200), null)
  assert.equal(validateBio(`  ${'x'.repeat(200)}  `, 200), null)
  assert.notEqual(validateBio('x'.repeat(201), 200), null)
})

test('list comparison is exact and order-sensitive, so "nothing changed" is only claimed when true', () => {
  assert.equal(sameList(['a', 'b'], ['a', 'b']), true)
  assert.equal(sameList([], []), true)
  assert.equal(sameList(['a', 'b'], ['b', 'a']), false)
  assert.equal(sameList(['a'], ['a', 'b']), false)
})

test('password confirmation must be present and equal', () => {
  assert.notEqual(validateConfirmation('secret-phrase', ''), null)
  assert.notEqual(validateConfirmation('secret-phrase', 'secret-phrasE'), null)
  assert.equal(validateConfirmation('secret-phrase', 'secret-phrase'), null)
})
