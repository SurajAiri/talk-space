/**
 * TILE ASSET PACK: the ground layer. One entry per tile type.
 *
 * To add a tile: write a draw function (x, y = pixel top-left of the cell, c, r = its
 * column/row so you can vary the pattern) and add ONE entry to TILESET with a unique
 * numeric `id` and a unique single-character `char`. The map file format, the editor
 * palette and the CLI pick it up automatically. Never reuse or renumber a `char` that
 * existing map files already use.
 *
 * Pure canvas code, no app imports, safe to copy into another project with `../types.ts`.
 */
import { TILE } from '../types.ts'

export type TileCategory = 'ground' | 'floor' | 'wall' | 'water'

export interface TileDef {
  /** numeric id used at runtime */
  id: number
  /** the character used for this tile in map files (`tiles` rows) */
  char: string
  name: string
  category: TileCategory
  /** blocks walking */
  solid: boolean
  /** flat colour for tiny UI swatches / fallbacks */
  swatch: string
  draw: (g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number) => void
}

function drawGrass(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  g.fillStyle = (c + r) % 2 === 0 ? '#3f8f4e' : '#3a8648'
  g.fillRect(x, y, TILE, TILE)
  g.fillStyle = '#4da65d'
  if ((c * 7 + r * 13) % 3 === 0) {
    g.fillRect(x + 10, y + 12, 3, 6)
    g.fillRect(x + 14, y + 14, 3, 4)
  }
}

// =============================================================================================
// EXTENDED PACK (Lodge / Zen Garden / Orbital maps)
// A tile's draw() only sees its own cell, so anything that has to JOIN UP with its neighbours
// (rugs, bridges, fences) is its own tile. Texture comes from `noise(c, r)`: deterministic per
// cell, so tiles look hand-varied but never flicker or need stored state.
// =============================================================================================

/** Deterministic noise in [0, 1) from a cell position (and a salt `k` for independent streams). */
function noise(c: number, r: number, k = 0): number {
  let h = Math.imul(c + 1013, 374761393) ^ Math.imul(r + 7919, 668265263) ^ Math.imul(k + 17, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const fillCell = (g: CanvasRenderingContext2D, x: number, y: number, color: string) => {
  g.fillStyle = color
  g.fillRect(x, y, TILE, TILE)
}

// ---- bake cache -------------------------------------------------------------------------------
// Drawing a textured tile costs dozens of canvas calls; a room shows ~700 tiles per frame. So static
// tile art is painted ONCE per look-alike variant into a small bitmap and blitted (one call per tile).
// Only genuinely animated bits are drawn live on top. Falls back to direct drawing when no offscreen
// surface exists (e.g. the Node CLI). Both paths look the same in kind, but individual speckles land in
// different places (the baked path paints with synthetic cell coordinates), so they are not pixel-identical.

function makeSurface(w: number, h: number): OffscreenCanvas | HTMLCanvasElement | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  if (typeof document !== 'undefined') {
    const el = document.createElement('canvas')
    el.width = w
    el.height = h
    return el
  }
  return null
}

/** Device pixels per world pixel, bucketed 1..3, so bitmaps stay sharp at the current zoom without unbounded variants. */
function scaleBucket(g: CanvasRenderingContext2D): number {
  const m = typeof g.getTransform === 'function' ? g.getTransform() : null
  return Math.min(3, Math.max(1, Math.ceil((m ? Math.hypot(m.a, m.b) : 2) - 0.05)))
}

type Painter = (g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number) => void

/**
 * Wrap a STATIC tile painter. It may depend on noise(c, r) and on the parity of c and r (checkerboards),
 * nothing else: each (variant, parity) is painted once using a synthetic cell with that parity.
 */
function baked(paint: Painter, variants = 6): Painter {
  const cache = new Map<string, CanvasImageSource>()
  return (g, x, y, c, r, time) => {
    const k = scaleBucket(g)
    const v = Math.floor(noise(c, r, 99) * variants)
    const id = `${k}|${v}|${c & 1}${r & 1}`
    let bmp = cache.get(id)
    if (!bmp) {
      const s = makeSurface(TILE * k, TILE * k)
      const sg = s?.getContext('2d') as CanvasRenderingContext2D | null | undefined
      if (!s || !sg) {
        paint(g, x, y, c, r, time)
        return
      }
      sg.scale(k, k)
      paint(sg, 0, 0, 2 * (v + 8) + (c & 1), 2 * (v * 3 + 5) + (r & 1), 0)
      cache.set(id, s)
      bmp = s
    }
    g.drawImage(bmp, x, y, TILE, TILE)
  }
}

/** 8 pre-built alpha steps: animated tiles pick one instead of building a colour string per tile per frame. */
const alphaSteps = (rgb: string, lo: number, hi: number) => Array.from({ length: 8 }, (_, i) => `rgba(${rgb}, ${(lo + ((hi - lo) * i) / 7).toFixed(3)})`)
const STAR = alphaSteps('255, 255, 255', 0.15, 1)
const GLOW = alphaSteps('56, 189, 248', 0.12, 0.62)
const RIPPLE = alphaSteps('255, 255, 255', 0.28, 0.02)

function drawPineFloor(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, (c + r) % 2 === 0 ? '#2d5a38' : '#2a5434')
  g.fillStyle = '#21472b'
  for (let i = 0; i < 6; i++) g.fillRect(x + 3 + noise(c, r, i) * 38, y + 3 + noise(c, r, i + 8) * 40, 6, 1.6)
  g.fillStyle = '#4a8456'
  for (let i = 0; i < 4; i++) g.fillRect(x + 3 + noise(c, r, i + 20) * 40, y + 3 + noise(c, r, i + 30) * 40, 4, 1.4)
  if (noise(c, r, 40) > 0.8) {
    g.fillStyle = '#7c5a3a'
    g.beginPath()
    g.ellipse(x + 10 + noise(c, r, 41) * 28, y + 10 + noise(c, r, 42) * 28, 3.2, 2.2, 0.5, 0, Math.PI * 2)
    g.fill()
  }
}

function drawDirt(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, (c + r) % 2 === 0 ? '#b3875f' : '#ab7f58')
  g.fillStyle = 'rgba(92, 58, 30, 0.1)'
  g.beginPath()
  g.arc(x + 14 + noise(c, r, 1) * 20, y + 14 + noise(c, r, 2) * 20, 11 + noise(c, r, 3) * 4, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#d9b992'
  for (let i = 0; i < 4; i++) g.fillRect(x + 4 + noise(c, r, i + 5) * 38, y + 4 + noise(c, r, i + 12) * 38, 3, 2.4)
  g.fillStyle = '#8b6240'
  for (let i = 0; i < 3; i++) g.fillRect(x + 4 + noise(c, r, i + 20) * 38, y + 4 + noise(c, r, i + 26) * 38, 2.6, 2)
}

function drawLodgeFloor(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  const boards = ['#8d5a34', '#865230', '#925f39']
  for (let i = 0; i < 3; i++) {
    const by = y + i * 16
    g.fillStyle = boards[Math.floor(noise(c, r, i + 40) * 3)]!
    g.fillRect(x, by, TILE, 16)
    g.fillStyle = 'rgba(40, 20, 8, 0.45)'
    g.fillRect(x, by + 14.5, TILE, 1.5)
    if (noise(c, r, i) > 0.55) g.fillRect(x + 6 + noise(c, r, i + 4) * 36, by, 1.5, 16)
  }
  g.fillStyle = 'rgba(255, 225, 180, 0.06)'
  g.fillRect(x, y, TILE, 2)
  if (noise(c, r, 9) > 0.85) {
    g.fillStyle = 'rgba(60, 30, 10, 0.5)'
    g.beginPath()
    g.ellipse(x + 10 + noise(c, r, 10) * 28, y + 8 + noise(c, r, 11) * 32, 3, 1.8, 0, 0, Math.PI * 2)
    g.fill()
  }
}

function drawLogWall(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, '#3b2210')
  g.fillStyle = '#c28a55'
  g.fillRect(x, y, TILE, 10)
  g.fillStyle = '#9a6633'
  g.fillRect(x, y + 8, TILE, 2)
  const logs = ['#8a5a30', '#7e5029', '#8f5f34']
  for (let i = 0; i < 3; i++) {
    const ly = y + 10 + i * 12
    g.fillStyle = logs[Math.floor(noise(c, r, i + 40) * 3)]!
    g.fillRect(x, ly, TILE, 11)
    g.fillStyle = 'rgba(255, 230, 190, 0.28)'
    g.fillRect(x, ly, TILE, 2)
    g.fillStyle = 'rgba(0, 0, 0, 0.3)'
    g.fillRect(x, ly + 8, TILE, 3)
    g.fillStyle = 'rgba(50, 25, 8, 0.4)'
    g.fillRect(x + 4 + noise(c, r, i) * 30, ly + 4, 8 + noise(c, r, i + 5) * 8, 1.2)
  }
}

function drawCliff(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, '#46566c')
  g.save()
  if (noise(c, r, 70) > 0.5) {
    g.translate(x + TILE, y) // mirror, so neighbouring facets do not repeat in lockstep
    g.scale(-1, 1)
    x = 0
    y = 0
  }
  const j = (k: number) => (noise(c, r, k) - 0.5) * 18
  g.fillStyle = '#5d6e86'
  g.beginPath()
  g.moveTo(x, y)
  g.lineTo(x + 30 + j(1), y)
  g.lineTo(x + 16 + j(2), y + 24 + j(3))
  g.lineTo(x, y + 30)
  g.fill()
  g.fillStyle = '#3a4659'
  g.beginPath()
  g.moveTo(x + 30 + j(1), y)
  g.lineTo(x + TILE, y)
  g.lineTo(x + TILE, y + 28 + j(4))
  g.lineTo(x + 32 + j(5), y + 36)
  g.lineTo(x + 16 + j(2), y + 24 + j(3))
  g.fill()
  g.fillStyle = '#2f3a4b'
  g.beginPath()
  g.moveTo(x, y + 30)
  g.lineTo(x + 16 + j(2), y + 24 + j(3))
  g.lineTo(x + 32 + j(5), y + 36)
  g.lineTo(x + TILE, y + 28 + j(4))
  g.lineTo(x + TILE, y + TILE)
  g.lineTo(x, y + TILE)
  g.fill()
  g.strokeStyle = 'rgba(203, 213, 225, 0.45)'
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(x + 1, y + 29)
  g.lineTo(x + 1, y + 1)
  g.lineTo(x + 29 + j(1), y + 1)
  g.stroke()
  if (noise(c, r, 9) > 0.7) {
    g.fillStyle = 'rgba(101, 163, 13, 0.55)'
    g.beginPath()
    g.ellipse(x + 10 + noise(c, r, 10) * 28, y + 12 + noise(c, r, 11) * 22, 6, 3, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = 'rgba(15, 23, 42, 0.3)'
  g.fillRect(x, y + TILE - 5, TILE, 5)
  g.restore()
}

const shallowsBase = baked((g, x, y, c, r) => {
  fillCell(g, x, y, (c + r) % 2 === 0 ? '#5ad1e6' : '#52c9e0')
  g.fillStyle = 'rgba(253, 230, 138, 0.16)'
  for (let i = 0; i < 2; i++) {
    g.beginPath()
    g.arc(x + 12 + noise(c, r, i) * 24, y + 12 + noise(c, r, i + 3) * 24, 9 + noise(c, r, i + 6) * 5, 0, Math.PI * 2)
    g.fill()
  }
})

function drawShallows(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number) {
  shallowsBase(g, x, y, c, r, time)
  const w = Math.sin(time * 0.002 + c * 0.9 + r * 0.7) * 3
  g.strokeStyle = 'rgba(255, 255, 255, 0.55)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(x + 8 + w, y + 15)
  g.quadraticCurveTo(x + 17 + w, y + 10, x + 28 + w, y + 15)
  g.moveTo(x + 18 - w, y + 35)
  g.quadraticCurveTo(x + 28 - w, y + 30, x + 40 - w, y + 35)
  g.stroke()
}

function drawCarpet(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, '#14532d')
  g.fillStyle = (c + r) % 2 === 0 ? '#166534' : '#15803d'
  g.fillRect(x + 3, y + 3, TILE - 6, TILE - 6)
  g.strokeStyle = 'rgba(187, 247, 208, 0.22)'
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(x + TILE / 2, y + 9)
  g.lineTo(x + TILE - 9, y + TILE / 2)
  g.lineTo(x + TILE / 2, y + TILE - 9)
  g.lineTo(x + 9, y + TILE / 2)
  g.closePath()
  g.stroke()
}

/** One piece of the 9-slice rug. The flags say which sides of the rug this tile lies on. */
function rugPiece(top: boolean, bottom: boolean, left: boolean, right: boolean) {
  return (g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) => {
    drawLodgeFloor(g, x, y, c, r)
    const I = 4
    const x0 = x + (left ? I : 0)
    const x1 = x + TILE - (right ? I : 0)
    const y0 = y + (top ? I : 0)
    const y1 = y + TILE - (bottom ? I : 0)
    g.fillStyle = 'rgba(0, 0, 0, 0.2)'
    if (bottom) g.fillRect(x0, y1, x1 - x0, 3)
    if (right) g.fillRect(x1, y0, 3, y1 - y0)
    g.fillStyle = '#b32222'
    g.fillRect(x0, y0, x1 - x0, y1 - y0)
    // diamond motif in the middle of the visible field
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    g.fillStyle = 'rgba(254, 202, 202, 0.28)'
    g.beginPath()
    g.moveTo(cx, cy - 9)
    g.lineTo(cx + 9, cy)
    g.lineTo(cx, cy + 9)
    g.lineTo(cx - 9, cy)
    g.closePath()
    g.fill()
    // outer band + cream pinstripe on every rug edge this tile touches
    const BAND = 7
    g.fillStyle = '#7f1717'
    if (top) g.fillRect(x0, y0, x1 - x0, BAND)
    if (bottom) g.fillRect(x0, y1 - BAND, x1 - x0, BAND)
    if (left) g.fillRect(x0, y0, BAND, y1 - y0)
    if (right) g.fillRect(x1 - BAND, y0, BAND, y1 - y0)
    g.fillStyle = '#fde68a'
    const sx0 = left ? x0 + BAND + 1 : x0
    const sx1 = right ? x1 - BAND - 1 : x1
    const sy0 = top ? y0 + BAND + 1 : y0
    const sy1 = bottom ? y1 - BAND - 1 : y1
    if (top) g.fillRect(sx0, y0 + BAND + 1, sx1 - sx0, 1.6)
    if (bottom) g.fillRect(sx0, y1 - BAND - 2.6, sx1 - sx0, 1.6)
    if (left) g.fillRect(x0 + BAND + 1, sy0, 1.6, sy1 - sy0)
    if (right) g.fillRect(x1 - BAND - 2.6, sy0, 1.6, sy1 - sy0)
    // fringe on the top/bottom ends
    g.fillStyle = '#fde68a'
    if (top) for (let fx = x0 + 2; fx < x1 - 1; fx += 5) g.fillRect(fx, y0 - 3, 1.6, 3)
    if (bottom) for (let fx = x0 + 2; fx < x1 - 1; fx += 5) g.fillRect(fx, y1, 1.6, 3)
  }
}

function drawFenceH(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  drawGrass(g, x, y, c, r)
  g.fillStyle = 'rgba(15, 23, 42, 0.22)'
  g.fillRect(x, y + 34, TILE, 5)
  g.fillStyle = '#b8864b'
  g.fillRect(x, y + 18, TILE, 5)
  g.fillRect(x, y + 28, TILE, 5)
  g.fillStyle = '#dcab6c'
  g.fillRect(x, y + 18, TILE, 2)
  g.fillRect(x, y + 28, TILE, 2)
  g.fillStyle = '#8a5a2b'
  g.fillRect(x + 2, y + 12, 9, 26)
  g.fillStyle = '#c8975a'
  g.fillRect(x + 2, y + 10, 9, 4)
}

function drawFenceV(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  drawGrass(g, x, y, c, r)
  g.fillStyle = 'rgba(15, 23, 42, 0.22)'
  g.fillRect(x + 25, y, 6, TILE)
  g.fillStyle = '#b8864b'
  g.fillRect(x + 19, y, 6, TILE)
  g.fillStyle = '#dcab6c'
  g.fillRect(x + 19, y, 2, TILE)
  g.fillStyle = '#8a5a2b'
  g.fillRect(x + 15, y + 2, 14, 10)
  g.fillStyle = '#c8975a'
  g.fillRect(x + 15, y + 2, 14, 4)
}

function drawHedge(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, '#14532d')
  g.fillStyle = '#166534'
  for (let i = 0; i < 6; i++) {
    g.beginPath()
    g.arc(x + 11 + noise(c, r, i) * 26, y + 11 + noise(c, r, i + 6) * 26, 8 + noise(c, r, i + 12) * 3, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#22863a'
  for (let i = 0; i < 5; i++) {
    g.beginPath()
    g.arc(x + 9 + noise(c, r, i + 20) * 30, y + 8 + noise(c, r, i + 26) * 26, 4.5, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = 'rgba(134, 239, 172, 0.16)'
  g.fillRect(x, y, TILE, 8)
  g.fillStyle = 'rgba(0, 0, 0, 0.25)'
  g.fillRect(x, y + TILE - 6, TILE, 6)
}

function drawMoss(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, (c + r) % 2 === 0 ? '#2f6f45' : '#2b6841')
  g.fillStyle = 'rgba(10, 50, 30, 0.14)'
  g.beginPath()
  g.arc(x + 12 + noise(c, r, 1) * 24, y + 12 + noise(c, r, 2) * 24, 10, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(120, 210, 150, 0.14)'
  for (let i = 0; i < 3; i++) {
    g.beginPath()
    g.arc(x + 10 + noise(c, r, i + 4) * 28, y + 10 + noise(c, r, i + 8) * 28, 7 + noise(c, r, i + 12) * 4, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#4fa971'
  for (let i = 0; i < 5; i++) g.fillRect(x + 4 + noise(c, r, i + 20) * 38, y + 5 + noise(c, r, i + 24) * 36, 1.4, 3.4)
  if (noise(c, r, 30) > 0.94) {
    g.fillStyle = '#f0fdf4'
    g.fillRect(x + 12 + noise(c, r, 31) * 22, y + 12 + noise(c, r, 32) * 22, 3, 3)
  }
}

function drawGravel(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, (c + r) % 2 === 0 ? '#ddd5c0' : '#d9d0ba')
  g.lineWidth = 1.6
  for (let k = 0; k < 4; k++) {
    const y0 = y + 6 + k * 12
    // phase depends on the column (period = 2 tiles), so the rake lines flow unbroken across tiles
    g.strokeStyle = '#b9ae92'
    g.beginPath()
    for (let s = 0; s <= TILE; s += 4) {
      const yy = y0 + Math.sin((c * TILE + s) * (Math.PI / 48)) * 2.2
      if (s === 0) g.moveTo(x + s, yy)
      else g.lineTo(x + s, yy)
    }
    g.stroke()
    g.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    g.beginPath()
    for (let s = 0; s <= TILE; s += 4) {
      const yy = y0 + 2.4 + Math.sin((c * TILE + s) * (Math.PI / 48)) * 2.2
      if (s === 0) g.moveTo(x + s, yy)
      else g.lineTo(x + s, yy)
    }
    g.stroke()
  }
  g.fillStyle = '#cdc2a6'
  for (let i = 0; i < 4; i++) g.fillRect(x + 3 + noise(c, r, i) * 40, y + 3 + noise(c, r, i + 4) * 40, 2, 2)
}

function drawFlagstone(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, '#868b92')
  const sy = 21 + noise(c, r, 1) * 7
  const j1 = 12 + noise(c, r, 2) * 24
  const j2 = 12 + noise(c, r, 3) * 24
  const tones = ['#c9c5b9', '#bfbbae', '#d1cdc1', '#c3c0b6']
  const slab = (sx: number, sy0: number, w: number, h: number, k: number) => {
    g.fillStyle = tones[Math.floor(noise(c, r, k) * 4)]!
    g.fillRect(x + sx + 1.2, y + sy0 + 1.2, w - 2.4, h - 2.4)
    g.fillStyle = 'rgba(255, 255, 255, 0.3)'
    g.fillRect(x + sx + 1.2, y + sy0 + 1.2, w - 2.4, 1.6)
    g.fillStyle = 'rgba(0, 0, 0, 0.1)'
    g.fillRect(x + sx + 1.2, y + sy0 + h - 3.6, w - 2.4, 2.4)
  }
  slab(0, 0, j1, sy, 4)
  slab(j1, 0, TILE - j1, sy, 5)
  slab(0, sy, j2, TILE - sy, 6)
  slab(j2, sy, TILE - j2, TILE - sy, 7)
  if (noise(c, r, 9) > 0.8) {
    g.fillStyle = 'rgba(74, 140, 90, 0.7)'
    g.fillRect(x + j1 - 1, y + sy - 1, 4, 3)
  }
}

function drawTatami(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, '#d3d9a1')
  g.fillStyle = 'rgba(120, 140, 60, 0.2)'
  for (let yy = 4; yy < TILE; yy += 4) g.fillRect(x, y + yy, TILE, 1)
  g.fillStyle = '#46552a'
  g.fillRect(x, y, TILE, 3)
  g.fillRect(x, y + TILE - 3, TILE, 3)
  // each mat is two tiles long; the joint alternates per row so mats are staggered
  g.fillRect((c + r) % 2 === 0 ? x : x + TILE - 3, y, 3, TILE)
}

function drawShoji(g: CanvasRenderingContext2D, x: number, y: number) {
  fillCell(g, x, y, '#3a2a20')
  g.fillStyle = '#5c4033'
  g.fillRect(x, y, TILE, 10)
  g.fillStyle = '#7a5a45'
  g.fillRect(x, y, TILE, 3)
  for (let cx = 0; cx < 2; cx++) {
    for (let cy = 0; cy < 2; cy++) {
      g.fillStyle = '#fff4dc'
      g.fillRect(x + 3 + cx * 21, y + 13 + cy * 15, 19, 13)
      g.fillStyle = 'rgba(245, 225, 184, 0.7)'
      g.fillRect(x + 3 + cx * 21, y + 13 + cy * 15, 19, 3)
    }
  }
  g.fillStyle = '#2a1d15'
  g.fillRect(x, y + TILE - 5, TILE, 5)
}

const koiBase = baked((g, x, y, c, r) => {
  fillCell(g, x, y, (c + r) % 2 === 0 ? '#0f6f85' : '#0e667a')
  g.fillStyle = 'rgba(94, 200, 220, 0.18)'
  g.beginPath()
  g.ellipse(x + 24, y + 22, 18, 11, 0, 0, Math.PI * 2)
  g.fill()
  const n = noise(c, r, 1)
  if (n > 0.76) {
    const px = x + 12 + noise(c, r, 2) * 24
    const py = y + 12 + noise(c, r, 3) * 24
    g.fillStyle = '#3fae6a'
    g.beginPath()
    g.moveTo(px, py)
    g.arc(px, py, 8.5, 0.5, Math.PI * 2 - 0.3)
    g.closePath()
    g.fill()
    g.fillStyle = '#6fd493'
    g.beginPath()
    g.arc(px - 1.5, py - 1.5, 4, 0, Math.PI * 2)
    g.fill()
    if (n > 0.92) {
      g.fillStyle = '#f9a8d4'
      g.beginPath()
      g.arc(px + 2, py + 1, 3.6, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#fef3c7'
      g.beginPath()
      g.arc(px + 2, py + 1, 1.5, 0, Math.PI * 2)
      g.fill()
    }
  }
})

function drawKoiPond(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number) {
  koiBase(g, x, y, c, r, time)
  if (noise(c, r, 4) > 0.94) {
    const ph = noise(c, r, 5) * 6.28
    const a = time * 0.0006 + ph
    const b = time * 0.0009 + ph * 1.3
    const kx = x + 24 + Math.cos(a) * 12
    const ky = y + 24 + Math.sin(b) * 10
    const ang = Math.atan2(Math.cos(b) * 10 * 0.0009 * 1.3, -Math.sin(a) * 12 * 0.0006)
    g.save()
    g.translate(kx, ky)
    g.rotate(ang)
    g.fillStyle = noise(c, r, 6) > 0.5 ? '#fb923c' : '#f8fafc'
    g.beginPath()
    g.ellipse(0, 0, 8, 3.4, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#ef4444'
    g.beginPath()
    g.ellipse(1, 0, 3, 2, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = noise(c, r, 6) > 0.5 ? '#fdba74' : '#e2e8f0'
    g.beginPath()
    g.moveTo(-7, 0)
    g.lineTo(-13, -3.6)
    g.lineTo(-13, 3.6)
    g.fill()
    g.restore()
  }
  if (noise(c, r, 10) > 0.5) {
    const w = (time * 0.0008 + noise(c, r, 7) * 4) % 1
    g.strokeStyle = RIPPLE[Math.min(7, Math.floor(w * 8))]!
    g.lineWidth = 1.5
    g.beginPath()
    g.arc(x + 12 + noise(c, r, 8) * 24, y + 12 + noise(c, r, 9) * 24, 3 + w * 9, 0, Math.PI * 2)
    g.stroke()
  }
}

function drawBridgeH(g: CanvasRenderingContext2D, x: number, y: number, c: number) {
  fillCell(g, x, y, '#0e667a')
  g.fillStyle = 'rgba(0, 0, 0, 0.28)'
  g.fillRect(x, y + 40, TILE, 5)
  g.fillStyle = '#a8683b'
  g.fillRect(x, y + 8, TILE, 32)
  for (let px = 0; px < TILE; px += 12) {
    g.fillStyle = '#6f3f1f'
    g.fillRect(x + px, y + 8, 1.6, 32)
    g.fillStyle = 'rgba(255, 220, 170, 0.18)'
    g.fillRect(x + px + 2, y + 8, 3, 32)
  }
  g.fillStyle = '#dc2626'
  g.fillRect(x, y + 4, TILE, 6)
  g.fillRect(x, y + 38, TILE, 6)
  g.fillStyle = '#f87171'
  g.fillRect(x, y + 4, TILE, 2)
  g.fillRect(x, y + 38, TILE, 2)
  g.fillStyle = '#991b1b'
  g.fillRect(x, y + 8, TILE, 2)
  g.fillRect(x, y + 42, TILE, 2)
  if (c % 2 === 0) {
    for (const py of [y + 1, y + 35]) {
      g.fillStyle = '#b91c1c'
      g.fillRect(x + 2, py, 8, 11)
      g.fillStyle = '#fbbf24'
      g.fillRect(x + 1, py - 1, 10, 3)
    }
  }
}

function drawBridgeV(g: CanvasRenderingContext2D, x: number, y: number, _c: number, r: number) {
  fillCell(g, x, y, '#0e667a')
  g.fillStyle = 'rgba(0, 0, 0, 0.28)'
  g.fillRect(x + 40, y, 5, TILE)
  g.fillStyle = '#a8683b'
  g.fillRect(x + 8, y, 32, TILE)
  for (let py = 0; py < TILE; py += 12) {
    g.fillStyle = '#6f3f1f'
    g.fillRect(x + 8, y + py, 32, 1.6)
    g.fillStyle = 'rgba(255, 220, 170, 0.18)'
    g.fillRect(x + 8, y + py + 2, 32, 3)
  }
  g.fillStyle = '#dc2626'
  g.fillRect(x + 4, y, 6, TILE)
  g.fillRect(x + 38, y, 6, TILE)
  g.fillStyle = '#f87171'
  g.fillRect(x + 4, y, 2, TILE)
  g.fillRect(x + 38, y, 2, TILE)
  g.fillStyle = '#991b1b'
  g.fillRect(x + 8, y, 2, TILE)
  g.fillRect(x + 42, y, 2, TILE)
  if (r % 2 === 0) {
    for (const px of [x + 1, x + 35]) {
      g.fillStyle = '#b91c1c'
      g.fillRect(px, y + 2, 11, 8)
      g.fillStyle = '#fbbf24'
      g.fillRect(px - 1, y + 1, 13, 3)
    }
  }
}

function drawPlasterWall(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, '#e9dfc9')
  g.fillStyle = 'rgba(120, 100, 60, 0.12)'
  g.fillRect(x + 6 + noise(c, r, 1) * 30, y + 18, 3, 14)
  g.fillRect(x + 6 + noise(c, r, 2) * 30, y + 22, 2, 12)
  g.fillStyle = '#78716c'
  g.fillRect(x, y + TILE - 9, TILE, 9)
  g.fillStyle = '#a8a29e'
  g.fillRect(x, y + TILE - 9, TILE, 2)
  g.fillStyle = 'rgba(0, 0, 0, 0.16)'
  g.fillRect(x, y + 14, TILE, 4)
  g.fillStyle = '#3f434c'
  g.fillRect(x, y, TILE, 14)
  g.fillStyle = '#5b606c'
  for (let px = 0; px < TILE; px += 12) {
    g.beginPath()
    g.arc(x + px + 6, y + 14, 6, 0, Math.PI)
    g.fill()
  }
  g.fillStyle = 'rgba(255, 255, 255, 0.14)'
  g.fillRect(x, y, TILE, 2)
}

function drawMetalFloor(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, '#566479')
  g.fillStyle = (c + r) % 2 === 0 ? '#76869d' : '#71819a'
  g.fillRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3)
  g.fillStyle = 'rgba(255, 255, 255, 0.12)'
  g.fillRect(x + 1.5, y + 1.5, TILE - 3, 2)
  g.fillRect(x + 1.5, y + 1.5, 2, TILE - 3)
  g.fillStyle = '#4f5d72'
  for (const [rx, ry] of [[7, 7], [TILE - 7, 7], [7, TILE - 7], [TILE - 7, TILE - 7]] as const) {
    g.beginPath()
    g.arc(x + rx, y + ry, 1.7, 0, Math.PI * 2)
    g.fill()
  }
  if (noise(c, r, 1) > 0.82) {
    g.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(x + 12, y + 36)
    g.lineTo(x + 34, y + 14)
    g.stroke()
  }
}

function drawHazard(g: CanvasRenderingContext2D, x: number, y: number) {
  g.save()
  g.beginPath()
  g.rect(x, y, TILE, TILE)
  g.clip()
  fillCell(g, x, y, '#111827')
  g.fillStyle = '#eab308'
  // bands run along absolute (x + y), so the stripes continue unbroken from tile to tile
  const B = 12
  for (let s = Math.floor((x + y) / B) - 1; s * B < x + y + TILE * 2 + B; s++) {
    if (s % 2 !== 0) continue
    const u0 = s * B
    const u1 = u0 + B
    g.beginPath()
    g.moveTo(u0 - y, y)
    g.lineTo(u1 - y, y)
    g.lineTo(u1 - (y + TILE), y + TILE)
    g.lineTo(u0 - (y + TILE), y + TILE)
    g.fill()
  }
  g.restore()
}

/** The pulse is baked at 6 brightness levels, so an animated tile is still a single blit. */
const glowLevels = Array.from({ length: 6 }, (_, i) =>
  baked((g, x, y) => {
    fillCell(g, x, y, '#0a1830')
    g.fillStyle = '#0f2442'
    g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4)
    const step = GLOW[Math.round((i / 5) * 7)]!
    g.strokeStyle = step
    g.lineWidth = 1.5
    g.strokeRect(x + 2.75, y + 2.75, TILE - 5.5, TILE - 5.5)
    g.fillStyle = step
    g.fillRect(x + TILE / 2 - 1, y + TILE / 2 - 5, 2, 10)
    g.fillRect(x + TILE / 2 - 5, y + TILE / 2 - 1, 10, 2)
  }, 1),
)

function drawGlowFloor(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number) {
  glowLevels[Math.round((0.5 + 0.5 * Math.sin(time * 0.002 + (c + r) * 0.6)) * 5)]!(g, x, y, c, r, time)
}

const hullBase = baked((g, x, y) => {
  fillCell(g, x, y, '#2a3650')
  g.fillStyle = '#d3dbe8'
  g.fillRect(x, y, TILE, 10)
  g.fillStyle = '#aeb9cc'
  g.fillRect(x, y + 8, TILE, 2)
  g.fillStyle = '#3d4b69'
  g.fillRect(x + 3, y + 14, TILE - 6, TILE - 22)
  g.strokeStyle = '#5b6c8f'
  g.lineWidth = 1
  g.strokeRect(x + 3.5, y + 14.5, TILE - 7, TILE - 23)
  g.fillStyle = '#2a3650'
  for (let i = 0; i < 3; i++) g.fillRect(x + 24, y + 19 + i * 5, 16, 2)
  g.fillStyle = '#161e33'
  g.fillRect(x, y + TILE - 6, TILE, 6)
})

function drawHullWall(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number) {
  hullBase(g, x, y, c, r, time)
  const on = Math.sin(time * 0.003 + noise(c, r) * 20) > -0.2
  g.fillStyle = noise(c, r, 3) > 0.5 ? (on ? '#22d3ee' : '#0e7490') : on ? '#f59e0b' : '#92400e'
  g.beginPath()
  g.arc(x + 12, y + 26, 2.6, 0, Math.PI * 2)
  g.fill()
}

function drawStars(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number, n: number, pad: number) {
  for (let i = 0; i < n; i++) {
    const sx = x + pad + noise(c, r, i) * (TILE - pad * 2)
    const sy = y + pad + noise(c, r, i + 10) * (TILE - pad * 2)
    const tw = 0.55 + 0.45 * Math.sin(time * 0.002 + noise(c, r, i + 20) * 12)
    const big = noise(c, r, i + 30) > 0.85
    g.fillStyle = noise(c, r, i + 40) > 0.8 ? `rgba(186, 230, 253, ${tw})` : `rgba(255, 255, 255, ${tw})`
    g.fillRect(sx, sy, big ? 2.4 : 1.4, big ? 2.4 : 1.4)
    if (big) {
      g.fillRect(sx - 2, sy + 0.5, 6.4, 1.2)
      g.fillRect(sx + 0.6, sy - 2, 1.2, 6.4)
    }
  }
}

const viewportBase = baked((g, x, y, c, r) => {
  fillCell(g, x, y, '#1c2640')
  g.fillStyle = '#d3dbe8'
  g.fillRect(x, y, TILE, 5)
  g.fillStyle = '#030712'
  g.fillRect(x + 3, y + 8, TILE - 6, TILE - 16)
  drawStars(g, x + 3, y + 8, c, r, 0, 4, 3)
  g.fillStyle = 'rgba(255, 255, 255, 0.08)'
  g.beginPath()
  g.moveTo(x + 8, y + TILE - 8)
  g.lineTo(x + 24, y + 8)
  g.lineTo(x + 34, y + 8)
  g.lineTo(x + 18, y + TILE - 8)
  g.fill()
  g.fillStyle = '#0d1426'
  g.fillRect(x, y + TILE - 6, TILE, 6)
})

/** One live twinkling star per tile (on about half of them); the rest of the starfield is baked. */
function twinkle(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number, pad: number) {
  if (noise(c, r, 70) < 0.5) return
  const a = 0.5 + 0.5 * Math.sin(time * 0.002 + noise(c, r, 71) * 12)
  g.fillStyle = STAR[Math.round(a * 7)]!
  g.fillRect(x + pad + noise(c, r, 72) * (TILE - pad * 2), y + pad + noise(c, r, 73) * (TILE - pad * 2), 2, 2)
}

function drawViewport(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number) {
  viewportBase(g, x, y, c, r, time)
  twinkle(g, x, y, c, r, time, 10)
}

const voidBase = baked((g, x, y, c, r) => {
  fillCell(g, x, y, '#030617')
  if (noise(c, r, 50) > 0.93) {
    g.fillStyle = noise(c, r, 51) > 0.5 ? 'rgba(99, 102, 241, 0.012)' : 'rgba(168, 85, 247, 0.011)'
    for (let rad = 46; rad > 6; rad -= 5) {
      g.beginPath()
      g.arc(x + 24, y + 24, rad, 0, Math.PI * 2)
      g.fill()
    }
  }
  drawStars(g, x, y, c, r, 0, 2 + Math.floor(noise(c, r, 60) * 3), 2)
}, 10)

function drawVoid(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number) {
  voidBase(g, x, y, c, r, time)
  twinkle(g, x, y, c, r, time, 3)
}

function drawBioFloor(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  fillCell(g, x, y, '#6fa58f')
  g.fillStyle = (c + r) % 2 === 0 ? '#8fcab2' : '#86c2aa'
  g.fillRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3)
  g.fillStyle = 'rgba(255, 255, 255, 0.16)'
  g.fillRect(x + 1.5, y + 1.5, TILE - 3, 2)
  g.fillStyle = 'rgba(40, 110, 80, 0.2)'
  for (let i = 0; i < 4; i++) g.fillRect(x + 8, y + 10 + i * 8, TILE - 16, 1.4)
  if (noise(c, r, 1) > 0.85) {
    g.fillStyle = 'rgba(30, 100, 60, 0.3)'
    g.beginPath()
    g.ellipse(x + 14 + noise(c, r, 2) * 20, y + 14 + noise(c, r, 3) * 20, 6, 4, 0, 0, Math.PI * 2)
    g.fill()
  }
}


/** The 9-slice rug. Characters mirror a keyboard block:  Q W E / A S D / Z X C  =  TL T TR / L C R / BL B BR. */
const RUG_TILES: readonly TileDef[] = [
  { id: 17, char: 'Q', name: 'Rug top-left', category: 'floor', solid: false, swatch: '#b32222', draw: baked(rugPiece(true, false, true, false)) },
  { id: 18, char: 'W', name: 'Rug top', category: 'floor', solid: false, swatch: '#b32222', draw: baked(rugPiece(true, false, false, false)) },
  { id: 19, char: 'E', name: 'Rug top-right', category: 'floor', solid: false, swatch: '#b32222', draw: baked(rugPiece(true, false, false, true)) },
  { id: 20, char: 'A', name: 'Rug left', category: 'floor', solid: false, swatch: '#b32222', draw: baked(rugPiece(false, false, true, false)) },
  { id: 21, char: 'S', name: 'Rug center', category: 'floor', solid: false, swatch: '#b32222', draw: baked(rugPiece(false, false, false, false)) },
  { id: 22, char: 'D', name: 'Rug right', category: 'floor', solid: false, swatch: '#b32222', draw: baked(rugPiece(false, false, false, true)) },
  { id: 23, char: 'Z', name: 'Rug bottom-left', category: 'floor', solid: false, swatch: '#b32222', draw: baked(rugPiece(false, true, true, false)) },
  { id: 24, char: 'X', name: 'Rug bottom', category: 'floor', solid: false, swatch: '#b32222', draw: baked(rugPiece(false, true, false, false)) },
  { id: 25, char: 'C', name: 'Rug bottom-right', category: 'floor', solid: false, swatch: '#b32222', draw: baked(rugPiece(false, true, false, true)) },
]

export const TILESET: readonly TileDef[] = [
  { id: 0, char: '.', name: 'Grass', category: 'ground', solid: false, swatch: '#3f8f4e', draw: drawGrass },
  {
    id: 8, char: '*', name: 'Flower meadow', category: 'ground', solid: false, swatch: '#f472b6',
    draw(g, x, y, c, r, time) {
      drawGrass(g, x, y, c, r)
      const sway = Math.sin(time * 0.004 + c + r) * 1.5
      g.fillStyle = (c + r) % 2 === 0 ? '#f472b6' : '#facc15'
      g.beginPath()
      g.arc(x + 14 + sway, y + 16, 4, 0, Math.PI * 2)
      g.arc(x + 32 - sway, y + 30, 4, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#ffffff'
      g.fillRect(x + 13 + sway, y + 15, 2, 2)
      g.fillRect(x + 31 - sway, y + 29, 2, 2)
    },
  },
  {
    id: 9, char: ':', name: 'Sand', category: 'ground', solid: false, swatch: '#fde68a',
    draw(g, x, y, c, r) {
      g.fillStyle = (c + r) % 2 === 0 ? '#fde68a' : '#fcd34d'
      g.fillRect(x, y, TILE, TILE)
      if ((c * 5 + r * 9) % 7 === 0) {
        g.fillStyle = '#f59e0b'
        g.fillRect(x + 18, y + 22, 3, 3)
      }
    },
  },
  {
    id: 1, char: ',', name: 'Cobblestone', category: 'ground', solid: false, swatch: '#cbd5e1',
    draw(g, x, y) {
      g.fillStyle = '#cbd5e1'
      g.fillRect(x, y, TILE, TILE)
      g.strokeStyle = '#94a3b8'
      g.lineWidth = 1
      g.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4)
      g.fillStyle = '#e2e8f0'
      g.fillRect(x + 6, y + 6, 14, 12)
      g.fillRect(x + 24, y + 24, 16, 14)
    },
  },
  {
    id: 7, char: '=', name: 'Wooden deck', category: 'floor', solid: false, swatch: '#92400e',
    draw(g, x, y) {
      g.fillStyle = '#92400e'
      g.fillRect(x, y, TILE, TILE)
      g.fillStyle = '#78350f'
      for (let p = 8; p < TILE; p += 12) g.fillRect(x, y + p, TILE, 2)
    },
  },
  {
    id: 2, char: 'c', name: 'Café floor', category: 'floor', solid: false, swatch: '#d9a066',
    draw(g, x, y, c, r) {
      g.fillStyle = (c + r) % 2 === 0 ? '#d9a066' : '#d1975e'
      g.fillRect(x, y, TILE, TILE)
      g.fillStyle = 'rgba(120, 53, 15, 0.16)'
      g.fillRect(x, y + 15, TILE, 1.5)
      g.fillRect(x, y + 31, TILE, 1.5)
    },
  },
  {
    id: 3, char: 'r', name: 'Rec-room floor', category: 'floor', solid: false, swatch: '#818cf8',
    draw(g, x, y, c) {
      g.fillStyle = c % 2 === 0 ? '#818cf8' : '#747ff2'
      g.fillRect(x, y, TILE, TILE)
      g.fillStyle = 'rgba(255,255,255,0.06)'
      g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8)
    },
  },
  {
    id: 4, char: 's', name: 'Studio floor', category: 'floor', solid: false, swatch: '#94a3b8',
    draw(g, x, y, c, r) {
      g.fillStyle = (c + r) % 2 === 0 ? '#94a3b8' : '#8999ae'
      g.fillRect(x, y, TILE, TILE)
    },
  },
  {
    id: 5, char: '#', name: 'Wall', category: 'wall', solid: true, swatch: '#475569',
    draw(g, x, y) {
      g.fillStyle = '#475569'
      g.fillRect(x, y, TILE, TILE)
      g.fillStyle = '#cbd5e1'
      g.fillRect(x, y, TILE, 12)
      g.fillStyle = '#334155'
      g.fillRect(x, y + TILE - 6, TILE, 6)
    },
  },
  {
    id: 6, char: '~', name: 'Water', category: 'water', solid: true, swatch: '#0284c7',
    draw(g, x, y, c, r, time) {
      g.fillStyle = '#0284c7'
      g.fillRect(x, y, TILE, TILE)
      const wave = Math.sin(time * 0.003 + c * 0.8 + r * 0.5) * 4
      g.fillStyle = 'rgba(125, 211, 252, 0.45)'
      g.fillRect(x + 8 + wave, y + 14, 18, 3)
      g.fillRect(x + 18 - wave, y + 32, 14, 3)
    },
  },
  // ---- extended pack: Lodge / Zen Garden / Orbital (ids 10+, appended; existing ids never change) ----
  { id: 10, char: 'p', name: 'Pine floor', category: 'ground', solid: false, swatch: '#2d5a38', draw: baked(drawPineFloor) },
  { id: 11, char: 'd', name: 'Dirt path', category: 'ground', solid: false, swatch: '#b3875f', draw: baked(drawDirt) },
  { id: 12, char: 'w', name: 'Lodge floor', category: 'floor', solid: false, swatch: '#8d5a34', draw: baked(drawLodgeFloor) },
  { id: 13, char: 'L', name: 'Log wall', category: 'wall', solid: true, swatch: '#8a5a30', draw: baked(drawLogWall) },
  { id: 14, char: 'R', name: 'Cliff', category: 'wall', solid: true, swatch: '#46566c', draw: baked(drawCliff) },
  { id: 15, char: '-', name: 'Shallows', category: 'water', solid: false, swatch: '#5ad1e6', draw: drawShallows },
  { id: 16, char: 'k', name: 'Green carpet', category: 'floor', solid: false, swatch: '#166534', draw: baked(drawCarpet) },
  ...RUG_TILES,
  { id: 26, char: 'f', name: 'Fence', category: 'wall', solid: true, swatch: '#b8864b', draw: baked(drawFenceH) },
  { id: 27, char: '|', name: 'Fence vertical', category: 'wall', solid: true, swatch: '#b8864b', draw: baked(drawFenceV) },
  { id: 28, char: 'h', name: 'Hedge', category: 'wall', solid: true, swatch: '#166534', draw: baked(drawHedge) },
  { id: 29, char: 'm', name: 'Moss', category: 'ground', solid: false, swatch: '#2f6f45', draw: baked(drawMoss) },
  { id: 30, char: 'g', name: 'Raked gravel', category: 'ground', solid: false, swatch: '#ddd5c0', draw: baked(drawGravel) },
  { id: 31, char: 't', name: 'Flagstone', category: 'ground', solid: false, swatch: '#c9c5b9', draw: baked(drawFlagstone) },
  { id: 32, char: 'T', name: 'Tatami', category: 'floor', solid: false, swatch: '#d3d9a1', draw: baked(drawTatami) },
  { id: 33, char: 'j', name: 'Shoji wall', category: 'wall', solid: true, swatch: '#fff4dc', draw: baked(drawShoji) },
  { id: 34, char: 'y', name: 'Koi pond', category: 'water', solid: true, swatch: '#0f6f85', draw: drawKoiPond },
  { id: 35, char: 'b', name: 'Bridge horizontal (1 tile wide)', category: 'floor', solid: false, swatch: '#a8683b', draw: baked(drawBridgeH) },
  { id: 36, char: 'B', name: 'Bridge vertical (1 tile wide)', category: 'floor', solid: false, swatch: '#a8683b', draw: baked(drawBridgeV) },
  { id: 37, char: 'P', name: 'Plaster wall', category: 'wall', solid: true, swatch: '#e9dfc9', draw: baked(drawPlasterWall) },
  { id: 38, char: 'M', name: 'Metal floor', category: 'floor', solid: false, swatch: '#76869d', draw: baked(drawMetalFloor) },
  { id: 39, char: 'H', name: 'Hazard stripes', category: 'floor', solid: false, swatch: '#eab308', draw: baked(drawHazard) },
  { id: 40, char: 'G', name: 'Glow floor', category: 'floor', solid: false, swatch: '#0f2442', draw: drawGlowFloor },
  { id: 41, char: 'N', name: 'Hull wall', category: 'wall', solid: true, swatch: '#3d4b69', draw: drawHullWall },
  { id: 42, char: 'V', name: 'Viewport', category: 'wall', solid: true, swatch: '#030712', draw: drawViewport },
  { id: 43, char: 'v', name: 'Deep space', category: 'wall', solid: true, swatch: '#030617', draw: drawVoid },
  { id: 44, char: 'Y', name: 'Bio floor', category: 'floor', solid: false, swatch: '#8fcab2', draw: baked(drawBioFloor) },
]

const BY_ID = new Map(TILESET.map((t) => [t.id, t]))
const BY_CHAR = new Map(TILESET.map((t) => [t.char, t]))
export const tileById = (id: number): TileDef | undefined => BY_ID.get(id)
export const tileByChar = (ch: string): TileDef | undefined => BY_CHAR.get(ch)
/** The tile new maps are filled with. */
export const DEFAULT_TILE: TileDef = TILESET[0]!

export function drawTile(g: CanvasRenderingContext2D, id: number, c: number, r: number, time: number) {
  BY_ID.get(id)?.draw(g, c * TILE, r * TILE, c, r, time)
}
