import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MENU_MARGIN, placeMenu } from '../src/lib/menuAnchor.ts'

const M = MENU_MARGIN
const menu = { w: 244, h: 200 }
/** every corner of the menu must be on screen */
const onScreen = (p: { left: number; top: number }, size: { w: number; h: number }, view: { w: number; h: number }) =>
  p.left >= M && p.top >= M && p.left + size.w <= view.w - M && p.top + size.h <= view.h - M

test('plenty of room: it opens at the point, down and to the right', () => {
  assert.deepEqual(placeMenu({ x: 50, y: 100 }, menu, { w: 800, h: 600 }), { left: 50, top: 100 })
})

test('no room on the right: it opens to the LEFT of the point (and not off the left edge)', () => {
  const p = placeMenu({ x: 700, y: 100 }, menu, { w: 800, h: 600 })
  assert.equal(p.left, 700 - 244)
  assert.ok(onScreen(p, menu, { w: 800, h: 600 }))
})

test('the phone case from the bug report: a tap mid-screen with room on neither side slides in instead of leaving the screen', () => {
  const view = { w: 412, h: 890 }
  const p = placeMenu({ x: 190, y: 560 }, menu, view)
  assert.ok(onScreen(p, menu, view), JSON.stringify(p))
  assert.equal(p.left, 412 - M - 244)
})

test('no room below: it opens upwards; no room either way: it is pinned inside the screen', () => {
  const view = { w: 800, h: 600 }
  assert.equal(placeMenu({ x: 50, y: 550 }, menu, view).top, 550 - 200)
  const short = { w: 800, h: 300 } // a phone held sideways
  const p = placeMenu({ x: 50, y: 150 }, menu, short)
  assert.ok(onScreen(p, menu, short), JSON.stringify(p))
})

test('a menu as big as the screen is pinned to the margin (it scrolls) rather than pushed off', () => {
  const p = placeMenu({ x: 100, y: 100 }, { w: 500, h: 900 }, { w: 360, h: 640 })
  assert.deepEqual(p, { left: M, top: M })
})

test('wherever you tap, on any common screen and any menu height, all of it is on screen', () => {
  const views = [{ w: 360, h: 640 }, { w: 412, h: 890 }, { w: 390, h: 844 }, { w: 844, h: 390 }, { w: 1280, h: 720 }]
  for (const view of views) {
    for (const h of [90, 200, 260]) {
      const size = { w: Math.min(244, view.w - 16), h: Math.min(h, view.h - 16) }
      for (let x = 0; x <= view.w; x += 7) {
        for (let y = 0; y <= view.h; y += 11) {
          const p = placeMenu({ x, y }, size, view)
          assert.ok(onScreen(p, size, view), `view ${view.w}x${view.h}, menu ${size.w}x${size.h}, tap ${x},${y} -> ${JSON.stringify(p)}`)
        }
      }
    }
  }
})
