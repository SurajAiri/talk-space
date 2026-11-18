import assert from 'node:assert/strict'
import { test } from 'node:test'
import { firstName, tagLabel } from '../src/world/render/character.ts'

test('the tag above a head shows the first name only', () => {
  assert.equal(firstName('Ada Lovelace'), 'Ada')
  assert.equal(firstName('  Grace   Brewster Murray Hopper '), 'Grace')
  assert.equal(firstName('Linus'), 'Linus')
  assert.equal(firstName('María José'), 'María')
  assert.equal(firstName('   '), '   ', 'a blank name falls back to itself instead of an empty tag')
  assert.equal(firstName(''), '')
})

test('your own character is tagged "You"; everyone else gets their first name', () => {
  assert.equal(tagLabel({ isPlayer: true, name: 'Ada Lovelace', flair: '' }), 'You')
  assert.equal(tagLabel({ isPlayer: false, name: 'Ada Lovelace', flair: '' }), 'Ada')
  assert.equal(tagLabel({ isPlayer: false, name: 'Ada Lovelace', flair: '👑' }), 'Ada 👑')
  assert.equal(tagLabel({ isPlayer: true, name: 'Ada Lovelace', flair: '👑' }), 'You 👑', 'flair still shows')
})
