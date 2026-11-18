import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { createCanvas } from '@napi-rs/canvas'
import { PROP_CATALOG, SEAT_KINDS, SEAT_STYLES, propDef, propDepth, seatKind } from '../src/world/assets/props.ts'
import { parseMapFile } from '../src/world/format/mapFile.ts'
import { validateMap } from '../src/world/format/validate.ts'
import { computeSeatJoins, exitTile, facingFromSeats, nearestSeat, promptFor, seatAnchor, seatedOn, seatIndex, SNAP_PX } from '../src/world/interact.ts'
import { drawDepthSorted, propDepthItems } from '../src/world/render/scene.ts'
import { TILE, type Dir, type Prop, type Seat } from '../src/world/types.ts'
import { loadMap, makeEngine } from './engineHarness.ts'

const seat = (col: number, row: number, dir: Dir = 'down', style = 'bench'): Seat => ({ id: `s${col}-${row}`, col, row, dir, style, color: '#3b82f6' })
const MAPS = ['beach', 'commons', 'lodge', 'market', 'orbital', 'zen']

// ---------- the asset pack ----------

test('every seat style says what it does, and an unknown one falls back to a plain seat', () => {
  assert.deepEqual(SEAT_STYLES, ['bench', 'stool', 'sofa_cushion', 'beanbag', 'office_chair', 'log_seat', 'armchair', 'deck_chair', 'zabuton'], 'old maps and the editor list depend on the names and the order')
  for (const s of SEAT_STYLES) assert.ok(SEAT_KINDS[s].verb.length > 0)
  assert.equal(seatKind('deck_chair').posture, 'lie')
  assert.equal(seatKind('deck_chair').auto, false, 'a beach bed never lays you down just because you stopped on it')
  assert.equal(seatKind('zabuton').posture, 'cross')
  assert.equal(seatKind('nonsense').posture, 'sit')
})

test('every prop and every seat style draws, in every direction and both passes, without throwing', () => {
  const cv = createCanvas(600, 400)
  const g = cv.getContext('2d') as unknown as CanvasRenderingContext2D
  ;(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = function (w: number, h: number) { return createCanvas(w, h) }
  const props: Prop[] = []
  for (const d of PROP_CATALOG) {
    if (d.hidden) continue
    for (const v of d.variants ?? [undefined]) props.push({ type: d.type, col: 3, row: 3, w: d.w, h: d.h, solid: d.solid, ...(v ? { variant: v } : {}), ...(d.color ? { color: d.color } : {}) })
    if (d.resize !== 'none') props.push({ type: d.type, col: 3, row: 3, w: d.w + 2, h: d.resize === 'wh' ? d.h + 1 : d.h, solid: d.solid, ...(d.color ? { color: d.color } : {}) })
  }
  for (const style of SEAT_STYLES) for (const dir of ['up', 'down', 'left', 'right'] as const) for (const taken of [false, true]) {
    const s = { ...seat(3, 3, dir, style), taken, join: { left: true, right: false } }
    props.push({ type: 'seat', col: 3, row: 3, w: 1, h: 1, solid: false, seat: s })
  }
  for (const p of props) drawDepthSorted(g, propDepthItems([p]), [], 1234)
  assert.ok(props.length > 80)
})

test('a sofa and a seat each sort in two halves around a seated person; ordinary props still sort by their bottom edge', () => {
  const personY = (3 + 0.5) * TILE + 12 // someone seated on tile row 3
  const s = propDepth({ type: 'seat', col: 2, row: 3, w: 1, h: 1, solid: false })
  assert.ok(s.base < personY && personY < s.front, 'the seat is painted around the person: cushion behind, armrest in front')
  const sofa = propDepth({ type: 'sofa_horiz', col: 1, row: 3, w: 3, h: 1, solid: false })
  assert.ok(sofa.base < personY && personY < sofa.front, 'the sofa body is behind and its arms in front, so people are visible IN it, not hidden by it')
  const table = propDepth({ type: 'round_table', col: 1, row: 3, w: 1, h: 1, solid: true })
  assert.equal(table.base, 4 * TILE)
  assert.ok(propDef('sofa_horiz')!.front && propDef('seat')!.front)
})

test('the seated person is painted between the two halves of the sofa, not under it', () => {
  const order: string[] = []
  const sofa: Prop = { type: 'sofa_horiz', col: 1, row: 3, w: 3, h: 1, solid: false }
  const items = propDepthItems([sofa])
  const g = createCanvas(10, 10).getContext('2d') as unknown as CanvasRenderingContext2D
  // paint with the real draw calls swapped for markers
  const stubbed = items.map((it, i) => ({ ...it, draw: () => order.push(i === 0 ? 'sofa-body' : 'sofa-arms') }))
  drawDepthSorted(g, stubbed, [{ sortY: (3 + 0.5) * TILE + 12, draw: () => order.push('person') }], 0)
  assert.deepEqual(order, ['sofa-body', 'person', 'sofa-arms'])
})

test('every shipped map is still valid with no warnings (beach has parasols now)', () => {
  for (const key of MAPS) {
    const { map, issues } = parseMapFile(JSON.parse(fs.readFileSync(new URL(`../src/world/maps/data/${key}.map.json`, import.meta.url), 'utf8')))
    assert.ok(map, `${key}: ${JSON.stringify(issues)}`)
    assert.deepEqual(validateMap(map), [], key)
  }
})

// ---------- the rules ----------

test('you are on a seat only when standing still on its anchor: the same rule for you and for everyone else', () => {
  const idx = seatIndex([seat(5, 5)])
  const a = seatAnchor(seat(5, 5))
  assert.equal(seatedOn(idx, a.x, a.y, false)?.id, 's5-5')
  assert.equal(seatedOn(idx, a.x + SNAP_PX - 0.5, a.y, false)?.id, 's5-5', 'a little rounding is fine')
  assert.equal(seatedOn(idx, a.x + SNAP_PX + 3, a.y, false), null, 'on the tile but not on the seat: still standing')
  assert.equal(seatedOn(idx, a.x, a.y, true), null, 'walking over it is not sitting')
  assert.equal(seatedOn(idx, 0, 0, false), null)
})

test('a row of benches facing the same way becomes one long bench; other seats never join', () => {
  const row = [seat(3, 3), seat(4, 3), seat(5, 3)]
  computeSeatJoins(row)
  assert.deepEqual(row.map((s) => s.join), [{ left: false, right: true }, { left: true, right: true }, { left: true, right: false }])
  const up = [seat(3, 3, 'up'), seat(4, 3, 'up')]
  computeSeatJoins(up)
  // someone sitting facing up has their left on the map's right: the flags are in the SITTER's frame
  assert.deepEqual(up.map((s) => s.join), [{ left: true, right: false }, { left: false, right: true }])
  const side = [seat(3, 3, 'right'), seat(3, 4, 'right')]
  computeSeatJoins(side)
  assert.ok(side[0]!.join && side[1]!.join, 'benches facing sideways join along the column')
  const mixed = [seat(3, 3), seat(4, 3, 'up'), seat(5, 3, 'down', 'stool'), seat(6, 3, 'down', 'stool')]
  computeSeatJoins(mixed)
  assert.ok(mixed.every((s) => !s.join), 'different facing or non-bench: stand alone')
})

test('a sofa faces where its cushions look', () => {
  const sofa: Prop = { type: 'sofa_horiz', col: 10, row: 6, w: 3, h: 1, solid: false }
  assert.equal(facingFromSeats(sofa, []), 'down')
  assert.equal(facingFromSeats(sofa, [seat(10, 6, 'up', 'sofa_cushion'), seat(11, 6, 'up', 'sofa_cushion'), seat(12, 6, 'down', 'sofa_cushion')]), 'up')
  assert.equal(facingFromSeats(sofa, [seat(30, 6, 'up')]), 'down', 'seats elsewhere do not count')
})

test('the button says what to do: stand up if seated, else the nearest free seat verb', () => {
  assert.equal(promptFor(null, null), null)
  assert.equal(promptFor(null, seat(1, 1))?.label, 'Sit')
  assert.equal(promptFor(null, seat(1, 1, 'down', 'deck_chair'))?.label, 'Lie down')
  assert.equal(promptFor(seat(1, 1), seat(2, 2))?.label, 'Stand up')
  assert.equal(promptFor(seat(1, 1, 'down', 'deck_chair'), null)?.label, 'Get up')
  const seats = [seat(1, 1), seat(2, 1), seat(6, 6)]
  const at = seatAnchor({ col: 2, row: 1 })
  assert.equal(nearestSeat(seats, at.x, at.y, () => true)?.id, 's2-1')
  assert.equal(nearestSeat(seats, at.x, at.y, (s) => s.id !== 's2-1')?.id, 's1-1', 'skips the taken one')
  assert.equal(nearestSeat([seat(30, 30)], at.x, at.y, () => true), null, 'too far away: no button')
})

test('getting up steps to a free tile in front of the seat, never onto another seat or into a wall', () => {
  const map = loadMap('beach')
  const bench = map.seats.find((s) => s.style === 'bench' && s.col === 23 && s.row === 30)!
  const idx = seatIndex(map.seats)
  const t = exitTile(map, idx, bench)
  assert.ok(t)
  assert.ok(!idx.has(`${t.col},${t.row}`))
  assert.ok(Math.abs(t.col - bench.col) <= 1 && Math.abs(t.row - bench.row) <= 1)
})

// ---------- the real engine, driven by hand ----------

test('Sit (the E key / the button) walks you onto the seat; Stand up steps you off and does not pull you back', () => {
  const h = makeEngine(loadMap('beach'), { col: 23, row: 29 })
  try {
    h.step(5)
    assert.equal(h.e.prompt?.prompt.label, 'Sit', 'a free seat is in reach: the button shows')
    h.engine.interact()
    h.step(60)
    assert.equal(h.e.player.sittingSeat?.style, 'bench')
    assert.equal(h.e.prompt?.prompt.label, 'Stand up')
    assert.ok(h.e.player.sittingSeat!.taken, 'the seat is marked taken (beanbags squash)')
    h.engine.interact()
    h.step(60)
    assert.equal(h.e.player.sittingSeat, null)
    h.step(60)
    assert.equal(h.e.player.sittingSeat, null, 'dismissed: it does not sit you straight back down')
  } finally {
    h.close()
  }
})

test('clicking a seat sits you on it; clicking a seat somebody else is on walks you up to it instead', () => {
  const map = loadMap('beach')
  let h = makeEngine(map, { col: 23, row: 27 })
  h.e.walkToTile(25, 30)
  h.step(120)
  assert.equal(h.e.player.sittingSeat?.col, 25)
  h.close()

  h = makeEngine(map, { col: 24, row: 28 })
  h.placeRemote('bob', 23, 30)
  h.step(30)
  assert.equal(h.e.remote.get('bob')?.sittingSeat?.col, 23, 'everyone derives the same seat from the same position: nothing extra is sent')
  h.e.walkToTile(23, 30)
  h.step(120)
  assert.equal(h.e.player.sittingSeat, null, 'not on top of him')
  h.close()
})

test('a beach bed is never lain on by accident: stopping on it does nothing, the button offers "Lie down", pressing it lies you down', () => {
  const h = makeEngine(loadMap('beach'), { col: 33, row: 21 })
  try {
    h.hold('a', 20) // walk onto the bed at (32, 20) by keys... and stop right on its tile
    h.hold('w', 6)
    h.step(30)
    assert.equal(h.e.player.sittingSeat, null)
    assert.equal(h.e.prompt?.prompt.label, 'Lie down')
    h.engine.interact()
    h.step(80)
    assert.equal(h.e.player.sittingSeat?.style, 'deck_chair')
    assert.equal(seatKind(h.e.player.sittingSeat!.style).posture, 'lie')
    assert.equal(h.e.prompt?.prompt.label, 'Get up')
    h.draw() // the lying pose draws
  } finally {
    h.close()
  }
})

test('ordinary seats still seat you when you simply stop on them; walking away stands you up', () => {
  const h = makeEngine(loadMap('beach'), { col: 21, row: 28 })
  try {
    h.hold('s', 40)
    h.step(60)
    assert.equal(h.e.player.sittingSeat?.style, 'bench')
    h.hold('a', 25)
    h.step(10)
    assert.equal(h.e.player.sittingSeat, null)
  } finally {
    h.close()
  }
})

test('nothing about sitting changes what is sent: still just a position message: x, y, dir, moving', () => {
  const h = makeEngine(loadMap('beach'), { col: 23, row: 29 })
  const sent: Record<string, unknown>[] = []
  h.session.attach((m) => sent.push({ ...m }))
  try {
    h.step(5)
    h.engine.interact()
    h.step(90)
    assert.equal(h.e.player.sittingSeat?.style, 'bench')
    assert.ok(sent.length >= 3, 'positions were sent while walking onto the seat')
    for (const m of sent) assert.deepEqual(Object.keys(m).sort(), ['dir', 'moving', 'type', 'x', 'y'])
    const last = sent.at(-1)!
    assert.equal(last.moving, false)
    assert.deepEqual([last.x, last.y], [23.5, 30.5], 'the final position IS the seat anchor, which is all a remote screen needs to show you seated')
  } finally {
    h.close()
  }
})
