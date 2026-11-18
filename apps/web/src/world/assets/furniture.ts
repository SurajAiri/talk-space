/**
 * FURNITURE ASSET PACK: the everyday props (sofa, tables, counter, shelves, desk, arcade, plants, lamp, campfire,
 * fountain...) drawn properly: a ground shadow, a top face, a front face with real thickness, small details.
 *
 * Every painter here works in PROP-LOCAL pixels: (0, 0) is the prop's top-left corner and it covers
 * `p.w * TILE` x `p.h * TILE`. Two wrappers turn one into a catalog `draw`:
 *   still(fn) : painted ONCE per distinct look into a bitmap and blitted every frame (nothing moves)
 *   live(fn)  : painted every frame (flames, water, screens, leaves in the wind)
 * `seed` is a stable 0..1 number per position, so neighbouring props are not clones of each other.
 *
 * Pure canvas calls, no DOM or app imports.
 */
import { TILE, type Prop } from '../types.ts'
import { bakedSprite, circle, ellipse, glow, hexA, line, mix, noise, rr, shade, shadow, TAU, tri, type Ctx } from './paint.ts'

type Local = (g: Ctx, p: Prop, t: number, seed: number) => void
type Draw = (g: Ctx, p: Prop, time: number) => void

const seedOf = (p: Prop) => noise(p.col, p.row, 5)

const live =
  (fn: Local): Draw =>
  (g, p, t) => {
    g.save()
    g.translate(p.col * TILE, p.row * TILE)
    fn(g, p, t, seedOf(p))
    g.restore()
  }

const sprites = new Map<string, ReturnType<typeof bakedSprite>>()
/** `buckets`: how many different looks the seed may pick between (each is painted once). `pass` keeps a prop's base and front bitmaps apart. */
const still =
  (fn: Local, buckets = 1, pad = 26, pass = 'main'): Draw =>
  (g, p) => {
    const size = `${p.w}x${p.h}`
    let sp = sprites.get(size)
    if (!sp) sprites.set(size, (sp = bakedSprite(p.w * TILE, p.h * TILE, pad)))
    const bucket = Math.min(buckets - 1, Math.floor(seedOf(p) * buckets))
    sp(g, p.col * TILE, p.row * TILE, `${p.type}|${pass}|${p.variant ?? ''}|${p.color ?? ''}|${p.facing ?? ''}|${bucket}`, (sg) => fn(sg, p, 0, (bucket + 0.5) / buckets))
  }

const WOOD = '#7c4a24'
const WOOD_DARK = '#4a2c14'

// ---- sofa -------------------------------------------------------------------------------------------------------
// Two passes so people sit IN it: the base (frame, back rest, cushions) sorts just behind a seated person, the front
// (the arms at both ends) just in front. Facing up mirrors it: the back rest is then between us and the person.

function sofaParts(g: Ctx, p: Prop, part: 'back' | 'seat' | 'arms') {
  const W = p.w * TILE
  const c = p.color || '#f59e0b'
  if (part === 'back') {
    rr(g, 3, 3, W - 6, 26, 9, shade(c, -0.36))
    rr(g, 3, 1, W - 6, 26, 9, shade(c, -0.14))
    g.fillStyle = 'rgba(255, 255, 255, 0.16)'
    g.beginPath()
    g.roundRect(8, 3, W - 16, 4, 2)
    g.fill()
    // buttoned tufting down the back
    for (let bx = 24; bx < W - 12; bx += 24) {
      circle(g, bx, 13, 1.6, shade(c, -0.4))
      circle(g, bx, 12.4, 1.1, shade(c, 0.1))
    }
  }
  if (part === 'seat') {
    // little feet, the dark plinth, then one cushion per tile
    for (const fx of [9, W - 15]) rr(g, fx, 43, 6, 4, 1.5, '#2a1708')
    rr(g, 3, 20, W - 6, 25, 6, shade(c, -0.44))
    for (let i = 0; i < p.w; i++) {
      const x = i * TILE + (i === 0 ? 11 : 2)
      const w = (i + 1) * TILE - (i === p.w - 1 ? 11 : 2) - x
      rr(g, x, 24, w, 20, 7, shade(c, -0.3))
      rr(g, x, 21, w, 20, 7, shade(c, 0.05))
      rr(g, x + 3, 22.5, w - 6, 6, 3, 'rgba(255, 255, 255, 0.2)')
    }
    // a throw pillow on the end cushion
    const pc = mix(c, '#ffffff', 0.62)
    rr(g, W - 25, 15, 14, 14, 4.5, shade(pc, -0.16))
    rr(g, W - 25, 14, 14, 14, 4.5, pc)
    g.strokeStyle = shade(pc, -0.25)
    g.lineWidth = 0.9
    g.beginPath()
    g.moveTo(W - 25, 14)
    g.lineTo(W - 11, 28)
    g.moveTo(W - 11, 14)
    g.lineTo(W - 25, 28)
    g.stroke()
  }
  if (part === 'arms') {
    for (const ax of [0, W - 12]) {
      rr(g, ax, 12, 12, 33, 6, shade(c, -0.4))
      rr(g, ax, 9, 12, 33, 6, shade(c, -0.08))
      rr(g, ax + 2, 10.4, 8, 6, 3, 'rgba(255, 255, 255, 0.22)')
    }
  }
}

function paintSofa(g: Ctx, p: Prop, layer: 'base' | 'front') {
  const up = p.facing === 'up'
  const W = p.w * TILE
  if (layer === 'base') shadow(g, W / 2, 46, W / 2 - 1, 4.4, 0.28)
  g.save()
  if (up) {
    g.translate(0, TILE)
    g.scale(1, -1)
  }
  if (layer === 'base') {
    if (!up) sofaParts(g, p, 'back')
    sofaParts(g, p, 'seat')
  } else {
    if (up) sofaParts(g, p, 'back')
    sofaParts(g, p, 'arms')
  }
  g.restore()
}

export const drawSofa = still((g, p) => paintSofa(g, p, 'base'))
export const drawSofaFront = still((g, p) => paintSofa(g, p, 'front'), 1, 26, 'front')

// ---- tables -----------------------------------------------------------------------------------------------------

function cup(g: Ctx, x: number, y: number, coffee = '#5a3416') {
  ellipse(g, x, y + 1.4, 5.6, 2.5, '#e2e8f0')
  ellipse(g, x, y + 0.6, 5.6, 2.5, '#f8fafc')
  rr(g, x - 3.2, y - 5.4, 6.4, 6.4, 2, '#ffffff')
  ellipse(g, x, y - 5, 3.2, 1.4, coffee)
  g.strokeStyle = '#f8fafc'
  g.lineWidth = 1.2
  g.beginPath()
  g.arc(x + 3.6, y - 2.4, 1.8, -1.2, 1.2)
  g.stroke()
}

/** A cafe table: pedestal, round top with a rim, and something on it. */
const roundTable: Local = (g, p, _t, seed) => {
  const media = p.type === 'media_table'
  const top = media ? '#3b4a63' : '#e2b887'
  shadow(g, 24, 42, 19, 5.2, 0.3)
  rr(g, 22, 25, 4, 16, 1.5, shade(top, -0.55))
  ellipse(g, 24, 42, 9, 3.2, shade(top, -0.6))
  ellipse(g, 24, 26.4, 21, 14.4, shade(top, -0.4))
  ellipse(g, 24, 23.4, 21, 14.4, top)
  ellipse(g, 24, 23.4, 17.4, 11.6, shade(top, 0.07))
  g.strokeStyle = 'rgba(255, 255, 255, 0.34)'
  g.lineWidth = 1.4
  g.beginPath()
  g.ellipse(24, 23.4, 20, 13.6, 0, Math.PI * 1.05, Math.PI * 1.55)
  g.stroke()
  if (!media) {
    g.strokeStyle = 'rgba(120, 74, 36, 0.28)'
    g.lineWidth = 0.9
    for (const [a, b] of [[-9, -3], [-4, 4], [3, -5]] as const) {
      g.beginPath()
      g.moveTo(24 + a - 4, 23 + b * 0.5)
      g.quadraticCurveTo(24 + a, 21 + b * 0.5, 24 + a + 7, 23 + b * 0.5)
      g.stroke()
    }
  }
  if (media) {
    // a laptop, open, and a mug
    rr(g, 12, 21, 21, 10, 2, '#94a3b8')
    rr(g, 13, 22, 19, 8, 1.4, '#cbd5e1')
    rr(g, 14, 8, 19, 14, 2, '#1e293b')
    rr(g, 15.4, 9.4, 16.2, 11, 1.2, '#38bdf8')
    g.fillStyle = 'rgba(255, 255, 255, 0.3)'
    g.fillRect(17, 11, 8, 1.5)
    g.fillRect(17, 14, 11, 1.5)
    cup(g, 36, 25, '#3b2314')
  } else if (seed < 0.34) {
    cup(g, 30, 24)
    cup(g, 17, 21, '#7c2d12')
  } else if (seed < 0.67) {
    // a little vase with flowers
    rr(g, 21.4, 16, 5.2, 8, 2, '#0f766e')
    for (const [fx, fy, fc] of [[22, 11, '#f472b6'], [26, 10, '#fde047'], [24, 13, '#fb7185']] as const) {
      line(g, 24, 16, fx, fy + 1.6, '#16a34a', 1)
      circle(g, fx, fy, 2.3, fc)
    }
    cup(g, 33, 26)
  } else {
    // a plate and a tiny candle
    ellipse(g, 20, 24, 6.4, 3, '#e2e8f0')
    ellipse(g, 20, 23.4, 5.4, 2.4, '#ffffff')
    circle(g, 20, 22.4, 1.8, '#f59e0b')
    rr(g, 30.4, 19, 4, 6.4, 1.2, '#fef3c7')
    circle(g, 32.4, 17.6, 1.6, '#fb923c')
  }
}
export const drawRoundTable = still(roundTable, 3)

/** The picnic table: planks, a cloth runner, legs. People sit on the benches (seats) on either side. */
const picnicTable: Local = (g, p, _t, seed) => {
  const W = p.w * TILE
  shadow(g, W / 2, 43, W / 2 - 3, 5, 0.28)
  // A-frame legs show under the front edge
  for (const lx of [10, W - 16]) {
    g.fillStyle = shade(WOOD, -0.5)
    tri(g, lx, 36, lx + 6, 36, lx + 3, 45)
    rr(g, lx - 1, 43.4, 8, 2.4, 1, shade(WOOD, -0.6))
  }
  rr(g, 3, 9, W - 6, 31, 4, shade('#b45309', -0.5))
  // the top: four planks end to end
  for (let i = 0; i < 4; i++) {
    const py = 7 + i * 6.4
    rr(g, 3, py, W - 6, 6, 1.6, i % 2 ? '#b45309' : '#c2610f')
    g.fillStyle = 'rgba(255, 255, 255, 0.14)'
    g.fillRect(5, py + 0.6, W - 10, 0.9)
    g.fillStyle = 'rgba(0, 0, 0, 0.18)'
    g.fillRect(3, py + 5.2, W - 6, 0.8)
  }
  rr(g, 3, 33, W - 6, 4, 2, shade('#b45309', -0.42))
  // cloth runner: red check
  const x0 = 14
  const x1 = W - 14
  g.save()
  g.beginPath()
  g.roundRect(x0, 14, x1 - x0, 14, 1.5)
  g.clip()
  for (let cx = x0; cx < x1; cx += 5) for (let cy = 14; cy < 28; cy += 5) {
    g.fillStyle = ((cx - x0) / 5 + (cy - 14) / 5) % 2 === 0 ? '#ef4444' : '#fef2f2'
    g.fillRect(cx, cy, 5, 5)
  }
  g.restore()
  // lunch
  ellipse(g, W * 0.34, 22, 6.2, 3, '#f8fafc')
  circle(g, W * 0.34, 21, 2.4, seed < 0.5 ? '#ef4444' : '#fbbf24')
  rr(g, W * 0.62, 16, 8, 8, 2, '#a16207')
  g.strokeStyle = '#78350f'
  g.lineWidth = 1
  g.beginPath()
  g.arc(W * 0.62 + 4, 16, 3.6, Math.PI, 0)
  g.stroke()
}
export const drawPicnicTable = still(picnicTable, 2)

// ---- counter and shelves ---------------------------------------------------------------------------------------

const cafeCounter: Local = (g, p, _t, seed) => {
  const W = p.w * TILE
  shadow(g, W / 2, 46, W / 2 - 2, 4.2, 0.3)
  // the front: wooden slats on a dark kick plate
  rr(g, 1, 22, W - 2, 24, 3, WOOD_DARK)
  rr(g, 1, 20, W - 2, 24, 3, WOOD)
  g.fillStyle = 'rgba(0, 0, 0, 0.24)'
  for (let x = 8; x < W - 5; x += 9) g.fillRect(x, 24, 1.2, 17)
  g.fillStyle = 'rgba(255, 255, 255, 0.1)'
  for (let x = 9; x < W - 5; x += 9) g.fillRect(x, 24, 0.9, 17)
  rr(g, 3, 40.4, W - 6, 4, 1.5, '#2a1708')
  // the top: a pale slab that overhangs the front
  rr(g, -1, 15, W + 2, 9, 3, '#94a3b8')
  rr(g, -1, 9, W + 2, 11, 3.5, '#f1f5f9')
  g.strokeStyle = 'rgba(100, 116, 139, 0.22)'
  g.lineWidth = 0.9
  for (let vx = 14; vx < W - 10; vx += 31) {
    g.beginPath()
    g.moveTo(vx, 10.4)
    g.quadraticCurveTo(vx + 6, 14, vx + 3, 18.6)
    g.stroke()
  }
  g.fillStyle = 'rgba(255, 255, 255, 0.7)'
  g.fillRect(2, 10, W - 4, 1.4)

  // an espresso machine
  const mx = 11
  rr(g, mx, -5, 27, 22, 4, '#7f1d1d')
  rr(g, mx, -6, 27, 18, 4, '#b91c1c')
  rr(g, mx + 2, -7.6, 23, 4, 2, '#e2e8f0')
  circle(g, mx + 13.5, 2, 3.8, '#f1f5f9')
  circle(g, mx + 13.5, 2, 2.8, '#1e293b')
  g.strokeStyle = '#facc15'
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(mx + 13.5, 2)
  g.lineTo(mx + 15.4, 0.6)
  g.stroke()
  rr(g, mx + 4, 10.6, 6, 5, 1.4, '#334155')
  rr(g, mx + 17, 10.6, 6, 5, 1.4, '#334155')
  rr(g, mx + 2, 15, 23, 3, 1.5, '#64748b')
  // cups
  cup(g, 58, 16)
  cup(g, 69, 15, '#7c2d12')
  // a glass cake dome
  const dx = Math.min(W - 60, 96)
  ellipse(g, dx, 16, 11, 3.4, '#e2e8f0')
  for (const [cx, cy] of [[-4, 11], [3, 10.4], [0, 8]] as const) ellipse(g, dx + cx, cy + 3, 4.6, 2.4, '#d6a05f')
  g.fillStyle = 'rgba(186, 230, 253, 0.34)'
  g.beginPath()
  g.arc(dx, 15, 10, Math.PI, 0)
  g.closePath()
  g.fill()
  g.strokeStyle = 'rgba(255, 255, 255, 0.8)'
  g.lineWidth = 1.2
  g.beginPath()
  g.arc(dx, 15, 10, Math.PI * 1.1, Math.PI * 1.7)
  g.stroke()
  circle(g, dx, 4.4, 1.6, '#e2e8f0')
  // a chalkboard menu
  const bx = W - 26
  rr(g, bx, -2, 17, 20, 2, '#a16207')
  rr(g, bx + 1.6, -0.4, 13.8, 16.4, 1, '#1f2937')
  g.fillStyle = 'rgba(248, 250, 252, 0.75)'
  for (const [ly, lw] of [[2.4, 8], [5.8, 10], [9.2, 6], [12.4, 9]] as const) g.fillRect(bx + 3, ly, lw, 1)
  circle(g, bx + 12.6, 2.6, 1.3, '#fb7185')
  // a small plant, for variety
  if (W >= 4 * TILE) {
    rr(g, 128, 10, 9, 7, 2, '#c2410c')
    for (const [ax, ay] of [[-3, -4], [0, -6.4], [3, -4]] as const) ellipse(g, 132.5 + ax, 7 + ay, 2.6, 4.2, seed < 0.5 ? '#16a34a' : '#22c55e')
  }
}
export const drawCafeCounter = still(cafeCounter, 2)

const BOOKS = ['#b91c1c', '#1d4ed8', '#15803d', '#ca8a04', '#7e22ce', '#0e7490', '#c2410c', '#be185d']

const bookshelf: Local = (g, p, _t, seed) => {
  const W = p.w * TILE
  shadow(g, W / 2, 45.4, W / 2 - 1, 3.6, 0.3)
  rr(g, 1, -3, W - 2, 49, 3, WOOD_DARK)
  rr(g, 1, -4, W - 2, 47, 3, shade(WOOD, 0.04))
  g.fillStyle = 'rgba(255, 255, 255, 0.2)'
  g.fillRect(3, -3, W - 6, 1.4)
  rr(g, 5, 2, W - 10, 38, 1.5, '#241406')
  for (let row = 0; row < 2; row++) {
    const top = 3 + row * 18
    const floor = top + 15.6
    let bx = 7
    let n = 0
    while (bx < W - 12) {
      const k = (i: number) => noise(p.col + n + Math.floor(seed * 7), p.row + row, i)
      const bw = 4 + Math.floor(k(1) * 3.4)
      const bh = 9.4 + Math.floor(k(2) * 5.4)
      const col = BOOKS[Math.floor(k(3) * BOOKS.length)]!
      if (k(4) > 0.9 && bx + 14 < W - 12) {
        // a stack lying down
        for (let s = 0; s < 3; s++) {
          rr(g, bx, floor - 3.6 * (s + 1), 13, 3.4, 0.8, BOOKS[Math.floor(k(5 + s) * BOOKS.length)]!)
        }
        bx += 14.4
      } else if (k(6) > 0.86) {
        // one leaning on its neighbour
        g.save()
        g.translate(bx + bw, floor)
        g.rotate(0.28)
        rr(g, -bw, -bh, bw, bh, 0.6, col)
        g.restore()
        bx += bw + 5
      } else {
        rr(g, bx, floor - bh, bw, bh, 0.7, col)
        g.fillStyle = 'rgba(255, 255, 255, 0.28)'
        g.fillRect(bx + 0.5, floor - bh + 0.5, 0.9, bh - 1)
        g.fillStyle = 'rgba(255, 255, 255, 0.5)'
        g.fillRect(bx + 0.6, floor - bh + 2.6, bw - 1.2, 0.9)
        g.fillRect(bx + 0.6, floor - 3, bw - 1.2, 0.9)
        bx += bw + 0.8
      }
      n++
    }
    rr(g, 3, floor, W - 6, 3, 1, WOOD)
    g.fillStyle = 'rgba(255, 255, 255, 0.18)'
    g.fillRect(4, floor + 0.2, W - 8, 0.8)
  }
  // something on top, so no two look the same
  if (seed < 0.4) {
    rr(g, W * 0.3, -11, 8, 7.4, 2, '#c2410c')
    for (const [ax, ay] of [[-3, -3], [0, -5.4], [3, -3]] as const) ellipse(g, W * 0.3 + 4 + ax, -11 + ay, 2.2, 3.6, '#22c55e')
  } else if (seed < 0.7) {
    circle(g, W * 0.7, -10, 5.4, '#2563eb')
    g.strokeStyle = '#facc15'
    g.lineWidth = 1
    g.beginPath()
    g.ellipse(W * 0.7, -10, 5.4, 1.8, 0, 0, TAU)
    g.stroke()
    rr(g, W * 0.7 - 2, -5, 4, 2, 1, '#a16207')
  }
}
export const drawBookshelf = still(bookshelf, 3)

// ---- recreation -------------------------------------------------------------------------------------------------

const pingpong: Local = (g, p) => {
  const W = p.w * TILE
  const H = p.h * TILE
  const top = '#1d6fa5'
  shadow(g, W / 2, H - 4, W / 2 - 4, 6, 0.3)
  // legs at the near corners
  for (const lx of [8, W - 14]) {
    rr(g, lx, H - 15, 6, 12, 1.5, '#1e293b')
    rr(g, lx - 1, H - 5, 8, 3, 1.5, '#0f172a')
  }
  rr(g, 4, 8, W - 8, H - 20, 5, shade(top, -0.55))
  rr(g, 4, 4, W - 8, H - 20, 5, '#0b3a57')
  rr(g, 6.4, 6.4, W - 12.8, H - 25, 3, top)
  g.fillStyle = 'rgba(255, 255, 255, 0.1)'
  g.beginPath()
  g.moveTo(6.4, 6.4)
  g.lineTo(W * 0.62, 6.4)
  g.lineTo(W * 0.3, H - 18.6)
  g.lineTo(6.4, H - 18.6)
  g.closePath()
  g.fill()
  // the lines
  g.strokeStyle = 'rgba(255, 255, 255, 0.92)'
  g.lineWidth = 1.6
  g.strokeRect(8, 8, W - 16, H - 29)
  g.beginPath()
  g.moveTo(W / 2, 8)
  g.lineTo(W / 2, H - 21)
  g.stroke()
  // the net: mesh between two posts, taped along the top
  const ny = (H - 14) / 2
  g.fillStyle = 'rgba(241, 245, 249, 0.34)'
  g.fillRect(3, ny - 7, W - 6, 8)
  g.strokeStyle = 'rgba(255, 255, 255, 0.42)'
  g.lineWidth = 0.7
  for (let nx = 5; nx < W - 3; nx += 3) {
    g.beginPath()
    g.moveTo(nx, ny - 7)
    g.lineTo(nx, ny + 1)
    g.stroke()
  }
  g.fillStyle = '#ffffff'
  g.fillRect(3, ny - 8, W - 6, 2)
  g.fillStyle = 'rgba(15, 23, 42, 0.25)'
  g.fillRect(3, ny + 1, W - 6, 1.6)
  for (const px of [2, W - 5]) rr(g, px, ny - 9, 3, 11, 1.2, '#cbd5e1')
  // two paddles and a ball
  const paddle = (px: number, py: number, rot: number, col: string) => {
    g.save()
    g.translate(px, py)
    g.rotate(rot)
    rr(g, -1.4, 0, 2.8, 6.4, 1, '#d6a05f')
    ellipse(g, 0, -2.4, 5, 5.6, shade(col, -0.35))
    ellipse(g, 0, -2.8, 5, 5.6, col)
    g.restore()
  }
  paddle(W * 0.28, H * 0.2, 0.5, '#dc2626')
  paddle(W * 0.72, H - 34, -0.4, '#111827')
  circle(g, W * 0.56, H * 0.3, 2, '#fff7ed')
}
export const drawPingpong = still(pingpong, 1, 12)

const arcade: Local = (g, p, t, seed) => {
  const tint = p.color || '#06b6d4'
  const pulse = 0.55 + 0.45 * Math.sin(t * 0.004 + seed * 6)
  shadow(g, 24, 45.4, 18, 4, 0.32)
  glow(g, 24, 16, 38, hexToRgb(tint), 0.1 + pulse * 0.07)
  // cabinet: side panels in the tint, a dark body
  rr(g, 6, 3, 36, 43, 5, shade('#1e1b4b', -0.4))
  rr(g, 6, 1, 36, 43, 5, '#1e1b4b')
  g.fillStyle = hexA(tint, 0.34)
  g.fillRect(6, 8, 3.4, 33)
  g.fillRect(38.6, 8, 3.4, 33)
  // marquee
  rr(g, 8, -5, 32, 10, 3, shade(tint, -0.5))
  rr(g, 9.4, -3.6, 29.2, 7.2, 2, hexA(tint, 0.5 + pulse * 0.5))
  g.fillStyle = 'rgba(255, 255, 255, 0.85)'
  for (let i = 0; i < 5; i++) g.fillRect(13 + i * 5.4, -1.2, 3.2, 2.4)
  // the screen
  rr(g, 10, 7, 28, 19, 3, '#050816')
  rr(g, 11.6, 8.6, 24.8, 15.6, 2, '#0b1226')
  const f = Math.floor(t / 420) % 2
  g.fillStyle = hexA(tint, 0.95)
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) g.fillRect(14 + c * 5.8 + (f ? 1.4 : -1.4), 10.6 + r * 4, 3.6, 2.4)
  g.fillStyle = '#facc15'
  g.fillRect(22, 20, 4, 1.8)
  g.fillRect(23.2, 19, 1.6, 1.4)
  g.fillStyle = 'rgba(255, 255, 255, 0.16)'
  g.beginPath()
  g.moveTo(11.6, 8.6)
  g.lineTo(26, 8.6)
  g.lineTo(11.6, 19)
  g.closePath()
  g.fill()
  // control deck, slanted: a joystick and three buttons
  rr(g, 8, 27.4, 32, 9, 2, '#475569')
  rr(g, 8, 26, 32, 8, 2, '#64748b')
  line(g, 16, 30, 16, 26.6, '#0f172a', 2)
  circle(g, 16, 25.8, 3, '#ef4444')
  circle(g, 15.2, 25, 1, '#fecaca')
  for (const [bx, bc] of [[26, '#facc15'], [31, '#22c55e'], [36, '#3b82f6']] as const) {
    circle(g, bx, 30.6, 2.4, shade(bc, -0.4))
    circle(g, bx, 30, 2.4, bc)
  }
  // coin door
  rr(g, 18, 38, 12, 6, 1.4, '#020617')
  rr(g, 22.6, 39.4, 2.8, 3.4, 0.8, '#facc15')
}

function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`
}
export const drawArcade = live(arcade)

const deskPod: Local = (g, p, t, seed) => {
  const W = p.w * TILE
  shadow(g, W / 2, 45, W / 2 - 1, 4.4, 0.28)
  // legs, the desk top with its front edge, a drawer unit
  for (const lx of [4, W - 8]) rr(g, lx, 36, 4, 10, 1, '#94a3b8')
  rr(g, 1, 27, W - 2, 15, 4, '#94a3b8')
  rr(g, 1, 20, W - 2, 15, 4, '#f1f5f9')
  g.fillStyle = 'rgba(255, 255, 255, 0.8)'
  g.fillRect(4, 21, W - 8, 1.3)
  g.fillStyle = 'rgba(100, 116, 139, 0.2)'
  g.fillRect(3, 34, W - 6, 1)
  // a monitor per tile, a keyboard in front of each
  for (let i = 0; i < p.w; i++) {
    const mx = i * TILE + 8
    rr(g, mx + 14, 13, 5, 9, 1, '#475569')
    rr(g, mx + 8, 20, 17, 3.4, 1.4, '#334155')
    rr(g, mx, -3, 33, 20, 3, '#0f172a')
    const k = 0.5 + 0.5 * Math.sin(t * 0.0016 + i * 2 + seed * 9)
    g.fillStyle = mix('#0ea5e9', '#6366f1', k)
    g.fillRect(mx + 1.8, -1.2, 29.4, 15.6)
    g.fillStyle = 'rgba(255, 255, 255, 0.5)'
    for (const [ly, lw] of [[1.4, 15], [4.4, 21], [7.4, 11], [10.4, 17]] as const) g.fillRect(mx + 4, ly, lw, 1.5)
    g.fillStyle = 'rgba(255, 255, 255, 0.14)'
    g.beginPath()
    g.moveTo(mx + 1.8, -1.2)
    g.lineTo(mx + 16, -1.2)
    g.lineTo(mx + 1.8, 9)
    g.closePath()
    g.fill()
    rr(g, mx + 2, 27, 26, 6.4, 1.6, '#64748b')
    rr(g, mx + 2, 26, 26, 6, 1.6, '#cbd5e1')
    g.fillStyle = 'rgba(71, 85, 105, 0.5)'
    for (let kx = mx + 4; kx < mx + 27; kx += 3.4) g.fillRect(kx, 27.4, 2.2, 1.4)
    for (let kx = mx + 4; kx < mx + 27; kx += 3.4) g.fillRect(kx, 30, 2.2, 1.4)
    ellipse(g, mx + 33, 29.6, 2.4, 3.2, '#475569')
  }
  // a mug and a small plant
  rr(g, W - 14, 18, 7, 7, 1.6, '#ef4444')
  g.strokeStyle = '#ef4444'
  g.lineWidth = 1.2
  g.beginPath()
  g.arc(W - 6.6, 21.6, 2, -1.3, 1.3)
  g.stroke()
  if (p.w >= 2) {
    rr(g, 3, 15, 7, 6, 1.6, '#f8fafc')
    for (const [ax, ay] of [[-2, -3], [0, -5], [2, -3]] as const) ellipse(g, 6.5 + ax, 14 + ay, 1.8, 3.2, '#22c55e')
  }
}
export const drawDeskPod = live(deskPod)

// ---- greenery, lamp, fire, water ------------------------------------------------------------------------------

const POTS = ['#c2410c', '#f1f5f9', '#64748b']

const plant: Local = (g, p, t, seed) => {
  const pot = POTS[Math.floor(seed * POTS.length)]!
  shadow(g, 24, 43, 14, 4, 0.28)
  // leaves fan out from the soil; the outer ones first so the inner ones sit in front
  const leaves = 9
  for (let i = 0; i < leaves; i++) {
    const side = i % 2 ? 1 : -1
    const k = Math.floor(i / 2)
    const a = -Math.PI / 2 + side * (0.3 + k * 0.28) + Math.sin(t * 0.0021 + i * 1.3 + p.col) * 0.035
    const len = 20 - k * 2.4 + (i === 0 ? 5 : 0)
    const bx = 24
    const by = 29
    const cx = bx + Math.cos(a) * len * 0.5
    const cy = by + Math.sin(a) * len * 0.5
    const col = ['#15803d', '#22c55e', '#16a34a', '#4ade80'][(i + Math.floor(seed * 4)) % 4]!
    g.save()
    g.translate(cx, cy)
    g.rotate(a)
    ellipse(g, 0, 0, len * 0.5, 4.8, col)
    g.strokeStyle = 'rgba(255, 255, 255, 0.34)'
    g.lineWidth = 0.9
    g.beginPath()
    g.moveTo(-len * 0.4, 0)
    g.lineTo(len * 0.42, 0)
    g.stroke()
    g.restore()
  }
  // the pot goes in front of the leaves' roots
  g.fillStyle = shade(pot, -0.28)
  g.beginPath()
  g.moveTo(13.4, 30)
  g.lineTo(34.6, 30)
  g.lineTo(31.6, 43.6)
  g.lineTo(16.4, 43.6)
  g.closePath()
  g.fill()
  g.fillStyle = pot
  g.beginPath()
  g.moveTo(13.4, 30)
  g.lineTo(34.6, 30)
  g.lineTo(32.4, 40)
  g.lineTo(15.6, 40)
  g.closePath()
  g.fill()
  rr(g, 11.6, 26.6, 24.8, 6, 2.4, shade(pot, 0.12))
  ellipse(g, 24, 27.2, 10, 2.4, '#3b2314')
  g.fillStyle = 'rgba(255, 255, 255, 0.24)'
  g.fillRect(16, 33, 2.4, 6)
}
export const drawPlant = live(plant)

/** Street lamp: a post, a glass lantern, and a faint halo so it reads as lit even in daylight. */
const lanternBody: Local = (g) => {
  shadow(g, 24, 44, 11, 3.6, 0.3)
  rr(g, 17, 38, 14, 6, 2, '#1e293b')
  rr(g, 18.4, 36.4, 11.2, 3, 1.4, '#334155')
  rr(g, 22, 8, 4, 30, 1.4, '#334155')
  g.fillStyle = 'rgba(255, 255, 255, 0.22)'
  g.fillRect(22.6, 9, 1, 28)
  // arms and the lantern cage
  rr(g, 21, 6, 6, 4, 1.4, '#0f172a')
  rr(g, 15.4, -9, 17.2, 16, 3, '#1e293b')
  rr(g, 17.6, -6.6, 12.8, 11.6, 2, '#fde68a')
  rr(g, 19, -5.4, 10, 8, 1.6, '#fef9c3')
  g.strokeStyle = '#1e293b'
  g.lineWidth = 1.2
  g.beginPath()
  g.moveTo(24, -6.6)
  g.lineTo(24, 5)
  g.stroke()
  // the roof and finial
  g.fillStyle = '#0f172a'
  tri(g, 12.6, -8.6, 35.4, -8.6, 24, -17.6)
  circle(g, 24, -18.4, 1.8, '#475569')
}
const lanternBaked = still(lanternBody, 1, 30)
export const drawLanternPost: Draw = (g, p, t) => {
  lanternBaked(g, p, t)
  glow(g, p.col * TILE + 24, p.row * TILE - 1, 34, '255, 214, 120', 0.2 + 0.03 * Math.sin(t * 0.006 + p.col))
}

const campfire: Local = (g, _p, t, seed) => {
  const T = t * 0.001 + seed * 10
  const flick = 0.5 + 0.5 * Math.sin(T * 9) * Math.sin(T * 5.3 + 1)
  // the fire is the focal point of a camp: draw it a size up, growing out of the middle of its tile
  g.translate(24, 36)
  g.scale(1.28, 1.28)
  g.translate(-24, -36)
  // scorched ground, then the back half of the stone ring
  ellipse(g, 24, 30, 21, 11, 'rgba(24, 14, 6, 0.34)')
  const stones = 10
  const stone = (i: number) => {
    const a = (i / stones) * TAU
    const sx = 24 + Math.cos(a) * 16.4
    const sy = 29 + Math.sin(a) * 8.6
    const sc = noise(i, 3, 2)
    ellipse(g, sx, sy + 1.6, 5.4, 3.8, '#57534e')
    ellipse(g, sx, sy, 5.4, 3.8, mix('#a8a29e', '#78716c', sc))
    ellipse(g, sx - 1.2, sy - 1, 2.6, 1.4, 'rgba(255, 255, 255, 0.3)')
  }
  for (let i = 0; i < stones; i++) if (Math.sin((i / stones) * TAU) <= 0) stone(i)
  // embers glowing under the logs
  glow(g, 24, 28, 26, '255, 120, 40', 0.5 + flick * 0.2)
  // two crossed logs with charred, glowing ends
  for (const [x1, y1, x2, y2] of [[11, 31, 37, 25], [12, 25, 36, 33]] as const) {
    line(g, x1, y1 + 1.6, x2, y2 + 1.6, '#2a1708', 6.4)
    line(g, x1, y1, x2, y2, '#6b4423', 5.6)
    line(g, x1 + 1, y1 - 1.2, x2 - 1, y2 - 1.2, 'rgba(255, 255, 255, 0.16)', 1.4)
    circle(g, x1, y1, 2.8, '#3a2312')
    circle(g, x2, y2, 2.8, '#d6a05f')
    circle(g, x2, y2, 1.4, '#b7793a')
  }
  // flames: tongues, tallest in the middle, each one swaying on its own beat
  const tongue = (cx: number, h: number, w: number, col: string, ph: number) => {
    const sway = Math.sin(T * 7 + ph) * 2.2
    const hh = h * (0.82 + 0.28 * Math.sin(T * 8.5 + ph * 1.7))
    g.fillStyle = col
    g.beginPath()
    g.moveTo(cx - w, 29)
    g.bezierCurveTo(cx - w * 1.1, 29 - hh * 0.5, cx + sway * 0.4, 29 - hh * 0.62, cx + sway, 29 - hh)
    g.bezierCurveTo(cx + sway * 0.8, 29 - hh * 0.55, cx + w * 1.1, 29 - hh * 0.42, cx + w, 29)
    g.closePath()
    g.fill()
  }
  tongue(18.4, 15, 4.6, '#ea580c', 1)
  tongue(29.6, 13, 4.4, '#ea580c', 2.4)
  tongue(24, 23, 7, '#f97316', 0)
  tongue(24, 16.4, 4.6, '#fbbf24', 0.8)
  tongue(24, 9.6, 2.6, '#fef9c3', 1.6)
  // the front stones, then sparks floating up
  for (let i = 0; i < stones; i++) if (Math.sin((i / stones) * TAU) > 0) stone(i)
  g.save()
  g.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 6; i++) {
    const life = (T * 0.9 + i * 0.37) % 1
    const sx = 24 + Math.sin(T * 3 + i * 2.1) * (4 + life * 8)
    const sy = 22 - life * 34
    g.fillStyle = `rgba(255, ${170 + i * 10}, 70, ${(1 - life) * 0.9})`
    g.beginPath()
    g.arc(sx, sy, 1.6 - life, 0, TAU)
    g.fill()
  }
  g.restore()
  glow(g, 24, 24, 70, '255, 150, 60', 0.1 + flick * 0.06)
}
export const drawCampfire = live(campfire)

const fountain: Local = (g, _p, t) => {
  const cx = 48
  const cy = 54
  shadow(g, cx, 88, 43, 8, 0.3)
  // the great basin: a stone wall with its thickness, then the rim and the water
  ellipse(g, cx, cy + 12, 44, 33, '#475569')
  ellipse(g, cx, cy + 7, 44, 33, '#64748b')
  g.strokeStyle = 'rgba(15, 23, 42, 0.3)'
  g.lineWidth = 1
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * 43.4, cy + 7 + Math.sin(a) * 32.4)
    g.lineTo(cx + Math.cos(a) * 43.4, cy + 12 + Math.sin(a) * 32.4)
    g.stroke()
  }
  ellipse(g, cx, cy, 44, 33, '#94a3b8')
  ellipse(g, cx, cy + 1, 37, 27, '#64748b')
  ellipse(g, cx, cy + 2.4, 36, 26, '#38bdf8')
  g.fillStyle = 'rgba(125, 211, 252, 0.7)'
  g.beginPath()
  g.ellipse(cx - 5, cy - 2, 28, 17, -0.06, Math.PI * 1.02, Math.PI * 1.9)
  g.fill()
  g.strokeStyle = 'rgba(255, 255, 255, 0.45)'
  g.lineWidth = 1.5
  g.beginPath()
  g.ellipse(cx, cy, 43, 32, 0, Math.PI * 1.08, Math.PI * 1.55)
  g.stroke()
  // ripples spreading out from where the water lands
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.00045 + i / 3) % 1
    g.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - k)})`
    g.lineWidth = 1.6
    g.beginPath()
    g.ellipse(cx, cy + 3, 8 + k * 26, 5 + k * 18, 0, 0, TAU)
    g.stroke()
  }
  // the pedestal and its upper bowl
  rr(g, cx - 5, cy - 18, 10, 24, 3, '#cbd5e1')
  rr(g, cx - 5, cy - 18, 3, 24, 2, 'rgba(255, 255, 255, 0.55)')
  ellipse(g, cx, cy + 5, 11, 4, '#94a3b8')
  ellipse(g, cx, cy - 15, 20, 11, '#94a3b8')
  ellipse(g, cx, cy - 17, 20, 11, '#e2e8f0')
  ellipse(g, cx, cy - 16.4, 15.6, 7.6, '#38bdf8')
  ellipse(g, cx - 3, cy - 18, 9, 3.4, 'rgba(255, 255, 255, 0.45)')
  // the jet: a plume, and drops arcing out to the lower basin
  rr(g, cx - 2.2, cy - 36, 4.4, 20, 2.2, 'rgba(224, 242, 254, 0.9)')
  circle(g, cx, cy - 37, 3.4, '#f0f9ff')
  g.strokeStyle = 'rgba(224, 242, 254, 0.82)'
  g.lineWidth = 1.8
  g.lineCap = 'round'
  for (const dir of [-1, 1, -0.5, 0.5]) {
    g.beginPath()
    g.moveTo(cx, cy - 36)
    g.quadraticCurveTo(cx + dir * 20, cy - 50, cx + dir * 28, cy - 17)
    g.stroke()
  }
  g.fillStyle = 'rgba(240, 249, 255, 0.85)'
  for (let i = 0; i < 9; i++) {
    const life = (t * 0.0011 + i / 9) % 1
    const dir = i % 2 ? 1 : -1
    const sp = 0.4 + (i % 3) * 0.3
    const dx = dir * sp * 28 * life
    const dy = -36 - Math.sin(life * Math.PI) * 14 * (1 - sp * 0.4) + life * life * 46
    g.beginPath()
    g.arc(cx + dx, cy + dy * 0.62 + 12, 1.5 - life * 0.5, 0, TAU)
    g.fill()
  }
}
export const drawFountain = live(fountain)

/** A beach parasol: a wooden pole in the sand, a striped canopy above it, and its shadow on the ground. Tint = the stripe colour. */
const parasol: Local = (g, p, _t, seed) => {
  const c = p.color || '#ef4444'
  const tilt = (seed - 0.5) * 5 // no two stand perfectly alike
  // the canopy's shadow falls beside the pole
  g.fillStyle = 'rgba(15, 23, 42, 0.2)'
  g.beginPath()
  g.ellipse(34, 43, 27, 8, 0, 0, TAU)
  g.fill()
  ellipse(g, 24, 44, 5, 2, 'rgba(15, 23, 42, 0.3)')
  // the pole, slightly leaning
  g.save()
  g.translate(24, 44)
  g.rotate(tilt * 0.012)
  rr(g, -1.6, -56, 3.2, 56, 1.4, '#a16207')
  g.fillStyle = 'rgba(255, 255, 255, 0.28)'
  g.fillRect(-0.9, -55, 0.9, 54)
  // the canopy: a dome of eight panels, alternating colour and white, with a scalloped hem
  g.translate(0, -52)
  g.rotate(tilt * 0.02)
  const top = -17
  const hemY = 0
  const halfW = 35
  const dome = () => {
    g.beginPath()
    g.moveTo(-halfW, hemY)
    g.quadraticCurveTo(-halfW * 0.8, top * 1.3, 0, top)
    g.quadraticCurveTo(halfW * 0.8, top * 1.3, halfW, hemY)
    for (let i = 7; i >= 0; i--) {
      const x0 = -halfW + (i + 1) * (halfW / 4)
      g.quadraticCurveTo(x0 - halfW / 8, hemY + 5, x0 - halfW / 4, hemY)
    }
    g.closePath()
  }
  g.fillStyle = shade(c, -0.25)
  dome()
  g.fill()
  g.save()
  dome()
  g.clip()
  for (let i = 0; i < 8; i++) {
    const x0 = -halfW + i * (halfW / 4)
    g.fillStyle = i % 2 ? '#f8fafc' : c
    g.beginPath()
    g.moveTo(0, top - 2)
    g.lineTo(x0, hemY + 6)
    g.lineTo(x0 + halfW / 4, hemY + 6)
    g.closePath()
    g.fill()
  }
  // light from the top left, a darker underside
  g.fillStyle = 'rgba(255, 255, 255, 0.2)'
  g.beginPath()
  g.ellipse(-halfW * 0.35, top * 0.55, halfW * 0.5, 4.4, -0.35, 0, TAU)
  g.fill()
  g.fillStyle = 'rgba(15, 23, 42, 0.16)'
  g.fillRect(-halfW, hemY - 3, halfW * 2, 8)
  g.restore()
  circle(g, 0, top - 1.2, 2.2, '#a16207')
  g.restore()
}
export const drawParasol = still(parasol, 3, 56)
