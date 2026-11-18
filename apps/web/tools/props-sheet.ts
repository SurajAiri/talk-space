/**
 * Contact sheets of the prop and seat art, drawn with the game's own code: the quickest way to judge a new or
 * changed prop without starting the app.
 *
 *   pnpm --filter web props            writes props-sheet.png and seats-sheet.png in the current folder
 *   pnpm --filter web props props      only the props sheet
 *   pnpm --filter web props seats      only the seats sheet (every style, every direction, empty / sat in / lain on)
 *
 * Optional 2nd argument: the scale (default 2).
 */
import fs from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'
import { PROP_CATALOG, SEAT_STYLES, seatKind } from '../src/world/assets/props.ts'
import { lookFor } from '../src/world/avatar.ts'
import { drawCharacter } from '../src/world/render/character.ts'
import { drawDepthSorted, propDepthItems } from '../src/world/render/scene.ts'
import { TILE, type Character, type Dir, type Prop, type Seat } from '../src/world/types.ts'

;(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = function (w: number, h: number) {
  return createCanvas(w, h)
}

interface Cell {
  w: number
  h: number
  props: Prop[]
  people: Character[]
}

const what = process.argv[2] ?? 'all'
const SC = Number(process.argv[3] ?? 2)
const FLOOR = ['#e8c872', '#f0d584']

function person(id: string, seat: Seat): Character {
  return {
    id,
    name: id,
    flair: '',
    status: 'available',
    isPlayer: false,
    x: (seat.col + 0.5) * TILE,
    y: (seat.row + 0.5) * TILE,
    dir: seat.dir,
    moving: false,
    walkFrame: 0,
    dancing: false,
    sittingSeat: seat,
    speechBubble: null,
    reaction: null,
    ...lookFor(id),
  }
}

function sheet(cells: Cell[], cols: number, file: string) {
  const cw = Math.max(...cells.map((c) => c.w))
  const ch = Math.max(...cells.map((c) => c.h))
  const rows = Math.ceil(cells.length / cols)
  const cv = createCanvas(cols * cw * TILE * SC, rows * ch * TILE * SC)
  const g = cv.getContext('2d') as unknown as CanvasRenderingContext2D
  g.scale(SC, SC)
  cells.forEach((c, i) => {
    g.save()
    g.translate((i % cols) * cw * TILE, Math.floor(i / cols) * ch * TILE)
    g.beginPath()
    g.rect(0, 0, cw * TILE, ch * TILE)
    g.clip()
    for (let r = 0; r < ch; r++) for (let q = 0; q < cw; q++) {
      g.fillStyle = FLOOR[(r + q) % 2]!
      g.fillRect(q * TILE, r * TILE, TILE, TILE)
    }
    const people = c.people.map((p) => ({ sortY: p.y + 12, draw: () => drawCharacter(g, p, p.x, p.y, 1, 1000) }))
    drawDepthSorted(g, propDepthItems(c.props), people, 1000)
    g.restore()
  })
  fs.writeFileSync(file, cv.toBuffer('image/png'))
  console.log(`${file}: ${cells.length} cells, ${cv.width}x${cv.height}`)
}

if (what === 'all' || what === 'props') {
  const cells: Cell[] = []
  for (const d of PROP_CATALOG) {
    if (d.hidden) continue
    for (const v of d.variants ?? [undefined]) {
      const p: Prop = { type: d.type, col: 1, row: 1, w: d.w, h: d.h, solid: d.solid, ...(v ? { variant: v } : {}), ...(d.color ? { color: d.color } : {}) }
      cells.push({ w: d.w + 2, h: d.h + 2, props: [p], people: [] })
    }
  }
  sheet(cells, 6, 'props-sheet.png')
}

if (what === 'all' || what === 'seats') {
  const dirs: Dir[] = ['down', 'up', 'left', 'right']
  const cells: Cell[] = []
  for (const style of SEAT_STYLES) {
    // per style: each direction empty, then each direction with somebody sitting (or lying) in it
    for (const occupied of [false, true]) for (const dir of dirs) {
      const seat: Seat = { id: 's', col: 1, row: 1, dir, style, color: seatKind(style).posture === 'lie' ? '#f97316' : '#3b82f6', ...(occupied ? { taken: true } : {}) }
      cells.push({ w: 3, h: 3, props: [{ type: 'seat', col: 1, row: 1, w: 1, h: 1, solid: false, seat }], people: occupied ? [person(`${style}${dir}`, seat)] : [] })
    }
  }
  sheet(cells, 8, 'seats-sheet.png')
}
