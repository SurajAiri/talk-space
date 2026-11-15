import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keyboardCoversBottom, MIN_COVER_PX, type KeyboardGeometry } from '../src/lib/virtualKeyboard.ts'

const phone = { layoutHeight: 844, visibleHeight: 844, visibleTop: 0, scale: 1, editableFocused: true } satisfies KeyboardGeometry
const KEYBOARD = 300

test('no keyboard: the whole layout viewport is on screen', () => {
  assert.equal(keyboardCoversBottom(phone), false)
})

test('keyboard drawn OVER the page (iOS Safari): only the visual viewport shrinks -> covers the bottom', () => {
  assert.equal(keyboardCoversBottom({ ...phone, visibleHeight: 844 - KEYBOARD }), true)
})

test('page SHRINKS to fit the keyboard (interactive-widget=resizes-content): both heights shrink -> badge rides above it, NOT covered', () => {
  assert.equal(keyboardCoversBottom({ ...phone, layoutHeight: 844 - KEYBOARD, visibleHeight: 844 - KEYBOARD }), false)
})

test('overlay keyboard, but the browser panned the page up so the bottom is visible again: NOT covered', () => {
  // the visible part has slid down to the layout bottom, so a fixed bottom-right badge is on screen
  assert.equal(keyboardCoversBottom({ ...phone, visibleHeight: 844 - KEYBOARD, visibleTop: KEYBOARD }), false)
})

test('the URL bar showing or hiding changes both heights alike: not a keyboard', () => {
  assert.equal(keyboardCoversBottom({ ...phone, layoutHeight: 844, visibleHeight: 844 - 56 }), false)
  assert.equal(keyboardCoversBottom({ ...phone, layoutHeight: 788, visibleHeight: 788 }), false)
})

test('a keyboard needs a text field: focus on a button or nothing is not a keyboard', () => {
  assert.equal(keyboardCoversBottom({ ...phone, visibleHeight: 844 - KEYBOARD, editableFocused: false }), false)
})

test('pinch-zoomed pages shrink the visual viewport without any keyboard', () => {
  assert.equal(keyboardCoversBottom({ ...phone, visibleHeight: 844 / 2, scale: 2 }), false)
})

test('the threshold: just under it is not a keyboard, at it is', () => {
  assert.equal(keyboardCoversBottom({ ...phone, visibleHeight: 844 - (MIN_COVER_PX - 1) }), false)
  assert.equal(keyboardCoversBottom({ ...phone, visibleHeight: 844 - MIN_COVER_PX }), true)
})

test('a phone held sideways works too (short screen, short keyboard)', () => {
  assert.equal(keyboardCoversBottom({ layoutHeight: 390, visibleHeight: 390 - 170, visibleTop: 0, scale: 1, editableFocused: true }), true)
})
