import assert from 'node:assert/strict'
import { test } from 'node:test'
import { firstName } from '../src/world/render/character.ts'

test('the tag above a head shows the first name only', () => {
  assert.equal(firstName('Ada Lovelace'), 'Ada')
  assert.equal(firstName('  Grace   Brewster Murray Hopper '), 'Grace')
  assert.equal(firstName('Linus'), 'Linus')
  assert.equal(firstName('María José'), 'María')
  assert.equal(firstName('   '), '   ', 'a blank name falls back to itself instead of an empty tag')
  assert.equal(firstName(''), '')
})
