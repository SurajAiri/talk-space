/**
 * SEAT ASSET PACK: every seat style, what it lets you do (sit, sit cross-legged, lie down) and how it is drawn.
 *
 * A seat is a walk-on spot on a tile. It is drawn in TWO passes so a person sitting in it ends up BETWEEN them:
 *   base  : painted before the person (the cushion, the legs, a backrest that is behind them)
 *   front : painted after the person (a backrest that is in front of them when they face away, an armrest)
 * See `seatDepth` for where each pass sorts, and render/scene.ts for how it is used.
 *
 * To add a style: add it to SEAT_KINDS (what it does), write its painter in PAINTERS (how it looks). Nothing else.
 * Pure canvas calls, no DOM or app imports.
 */
import { TILE, type Dir, type Prop, type Seat } from '../types.ts'
import { bakedSprite, circle, ellipse, line, rr, shade, shadow, TAU, type Ctx } from './paint.ts'

export type Posture = 'sit' | 'cross' | 'lie'

export interface SeatKind {
  /** how the body is posed: sat upright, sat cross-legged, or lying flat */
  posture: Posture
  /** the button text: "Sit", "Lie down" */
  verb: string
  /**
   * true  : stopping on the tile sits you down (benches, chairs: what people expect).
   * false : only an explicit action does (click it, press E, tap the button). A beach bed must not put you on
   *         your back because you stopped to look at the sea.
   */
  auto: boolean
  /** px the body sinks into it (a beanbag swallows you, a bench does not) */
  sink: number
  /** plain name, for the editor and for screen readers */
  label: string
}

/** Order matters: it is the order of the editor's style list, and old maps only ever refer to the names. */
export const SEAT_KINDS = {
  bench: { posture: 'sit', verb: 'Sit', auto: true, sink: 0, label: 'Bench' },
  stool: { posture: 'sit', verb: 'Sit', auto: true, sink: 0, label: 'Stool' },
  sofa_cushion: { posture: 'sit', verb: 'Sit', auto: true, sink: 3, label: 'Sofa cushion (put it on a sofa)' },
  beanbag: { posture: 'sit', verb: 'Sit', auto: true, sink: 6, label: 'Beanbag' },
  office_chair: { posture: 'sit', verb: 'Sit', auto: true, sink: 0, label: 'Office chair' },
  log_seat: { posture: 'sit', verb: 'Sit', auto: true, sink: 0, label: 'Log seat' },
  armchair: { posture: 'sit', verb: 'Sit', auto: true, sink: 2, label: 'Armchair' },
  deck_chair: { posture: 'lie', verb: 'Lie down', auto: false, sink: 0, label: 'Beach bed (lie down)' },
  zabuton: { posture: 'cross', verb: 'Sit', auto: true, sink: 2, label: 'Floor cushion' },
} as const satisfies Record<string, SeatKind>

export type SeatStyle = keyof typeof SEAT_KINDS
export const SEAT_STYLES = Object.keys(SEAT_KINDS) as SeatStyle[]

const FALLBACK: SeatKind = { posture: 'sit', verb: 'Sit', auto: true, sink: 0, label: 'Seat' }
/** What a style does. An unknown style (a typo in a map) behaves like a plain seat instead of crashing. */
export const seatKind = (style: string): SeatKind => (SEAT_KINDS as Record<string, SeatKind>)[style] ?? FALLBACK

/** Rotation that turns a "faces down" drawing to face each direction. */
export const SEAT_ANGLE: Record<Dir, number> = { down: 0, left: Math.PI / 2, up: Math.PI, right: -Math.PI / 2 }

export type SeatLayer = 'base' | 'front'

/**
 * Where each pass sorts against people, in px relative to the tile's BOTTOM edge (see PropDef.depth). A seated person
 * sorts at 36 px from the tile's top (their tile centre + 12), so -16 (= 32) is just behind them and -8 (= 40) just in
 * front. People standing on the tile above sort lower than 32 (the seat covers them) and people on the tile below
 * sort higher than 40 (they cover the seat).
 */
export const SEAT_DEPTH = { base: -16, front: -8 } as const

// ---------------------------------------------------------------------------------------------------
// painters. Each draws in the seat's own frame: origin = tile centre, the person faces DOWN (+y), so the
// back of the seat is at -y. `layer` says which pass is being painted; a painter only paints its own parts.
// ---------------------------------------------------------------------------------------------------

type Painter = (g: Ctx, s: Seat, layer: SeatLayer) => void

/** The layer a backrest belongs to: behind the person, unless they face away, then it is between us and them. */
const backLayer = (s: Seat): SeatLayer => (s.dir === 'up' ? 'front' : 'base')

/** An armrest on local side -1 (left) / +1 (right): the one on the screen's near (south) side is in front of the person. */
const armLayer = (s: Seat, side: -1 | 1): SeatLayer => (side * Math.sin(SEAT_ANGLE[s.dir]) * 15 > 4 ? 'front' : 'base')

const IRON = '#334155'

function plank(g: Ctx, x: number, y: number, w: number, h: number, c: string) {
  rr(g, x, y, w, h, 1.2, c)
  g.fillStyle = 'rgba(255, 255, 255, 0.16)'
  g.fillRect(x + 1, y + 0.4, w - 2, 0.9)
  g.fillStyle = 'rgba(0, 0, 0, 0.13)'
  g.fillRect(x + 1, y + h - 0.9, w - 2, 0.9)
}

const bench: Painter = (g, s, layer) => {
  const j = s.join
  const x0 = j?.left ? -24 : -21
  const x1 = j?.right ? 24 : 21
  const w = x1 - x0
  const wood = s.color
  if (layer === backLayer(s)) {
    // backrest: two slats on posts
    const post = shade(wood, -0.3)
    if (!j?.left) rr(g, x0 + 1.5, -20, 3.4, 18, 1.2, post)
    if (!j?.right) rr(g, x1 - 4.9, -20, 3.4, 18, 1.2, post)
    plank(g, x0 + (j?.left ? 0 : 1), -19, w - (j?.left ? 0 : 1) - (j?.right ? 0 : 1), 6.4, shade(wood, -0.1))
    plank(g, x0 + (j?.left ? 0 : 1), -12, w - (j?.left ? 0 : 1) - (j?.right ? 0 : 1), 6.4, shade(wood, -0.16))
  }
  if (layer === 'base') {
    // legs: iron, under the front edge, with a little foot each
    for (const lx of [x0 + 4.5, x1 - 7.5]) {
      rr(g, lx, 7, 3, 12, 1, IRON)
      rr(g, lx - 1.5, 17.5, 6, 2.4, 1.2, shade(IRON, -0.3))
    }
    // seat: three planks, with the thickness showing at the front
    rr(g, x0, 3.4, w, 11.4, 2, shade(wood, -0.38))
    plank(g, x0, -4, w, 5.4, shade(wood, 0.06))
    plank(g, x0, 1.8, w, 5.4, wood)
    plank(g, x0, 7.6, w, 5.4, shade(wood, -0.07))
    g.fillStyle = 'rgba(0, 0, 0, 0.18)'
    for (let gx = x0 + 6; gx < x1 - 5; gx += 11) g.fillRect(gx, 2.6 + ((gx * 7) % 5), 4, 0.8)
    // armrests at the open ends
    if (!j?.left) rr(g, x0 - 1.5, -8, 4.6, 18, 2.2, shade(wood, -0.22))
    if (!j?.right) rr(g, x1 - 3.1, -8, 4.6, 18, 2.2, shade(wood, -0.22))
  }
}

const stool: Painter = (g, s, layer) => {
  if (layer !== 'base') return
  const c = s.color
  for (const [x1, x2] of [[-7.5, -10], [7.5, 10], [0, 0.5]] as const) line(g, x1, 5, x2, 18, '#6b4423', 2.6)
  g.strokeStyle = '#6b4423'
  g.lineWidth = 1.6
  g.beginPath()
  g.ellipse(0, 12, 8.6, 3, 0, 0, TAU)
  g.stroke()
  ellipse(g, 0, 3.4, 13, 7.8, shade(c, -0.36))
  ellipse(g, 0, 0.8, 13, 7.8, shade(c, -0.06))
  ellipse(g, 0, 0.2, 10, 5.6, shade(c, 0.12))
  g.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  g.lineWidth = 1.2
  g.beginPath()
  g.ellipse(0, 0, 10, 5.6, 0, Math.PI * 1.05, Math.PI * 1.6)
  g.stroke()
}

const beanbag: Painter = (g, s, layer) => {
  if (layer !== 'base') return
  const c = s.color
  const squash = s.taken ? 0.82 : 1
  const wide = s.taken ? 1.1 : 1
  const blob = (dy: number) => {
    g.beginPath()
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU
      const r = 1 + 0.07 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 5 + 2)
      const x = Math.cos(a) * 17.5 * r * wide
      const y = Math.sin(a) * 14 * r * squash + 3 + dy
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
  }
  g.fillStyle = shade(c, -0.36)
  blob(3.2)
  g.fill()
  g.fillStyle = c
  blob(0)
  g.fill()
  // light from the top left, a darker belly, and the seams a bag is sewn from
  g.fillStyle = 'rgba(255, 255, 255, 0.26)'
  g.beginPath()
  g.ellipse(-5.5, -3.5 + (s.taken ? 3 : 0), 7.5, 4.2, -0.4, 0, TAU)
  g.fill()
  g.strokeStyle = shade(c, -0.28)
  g.lineWidth = 1
  g.lineCap = 'round'
  for (const [ex, ey] of [[-13, 9], [0, 13], [13, 9]] as const) {
    g.beginPath()
    g.moveTo(0, -2)
    g.quadraticCurveTo(ex * 0.35, ey * 0.2 + 2, ex, ey * (s.taken ? 0.8 : 1) + 2)
    g.stroke()
  }
  if (s.taken) ellipse(g, 0, 5.5, 9, 4.6, 'rgba(0, 0, 0, 0.2)')
  else circle(g, 0, -2.2, 2, shade(c, -0.3))
}

const officeChair: Painter = (g, s, layer) => {
  const c = s.color
  if (layer === backLayer(s)) {
    rr(g, -9.5, -22, 3, 12, 1.4, IRON)
    rr(g, 6.5, -22, 3, 12, 1.4, IRON)
    rr(g, -12, -23, 24, 14, 5.5, shade(c, -0.2))
    rr(g, -10.6, -22, 21.2, 11.4, 4.5, shade(c, -0.04))
    g.fillStyle = 'rgba(255, 255, 255, 0.14)'
    for (let ly = -19.5; ly < -12; ly += 3.4) g.fillRect(-9, ly, 18, 1)
  }
  if (layer === 'base') {
    // (the five-star base is on the ground, see GROUND) then the gas lift and the seat pad
    rr(g, -2, 2, 4, 11, 1.4, '#1e293b')
    circle(g, 0, 12, 3.3, '#1e293b')
    rr(g, -12, -3, 24, 17, 6.5, shade(c, -0.4))
    rr(g, -12, -6.5, 24, 17, 6.5, c)
    rr(g, -9.6, -5, 19.2, 7, 4, 'rgba(255, 255, 255, 0.16)')
    g.strokeStyle = shade(c, -0.3)
    g.lineWidth = 0.9
    g.beginPath()
    g.moveTo(0, 2)
    g.lineTo(0, 9.5)
    g.stroke()
  }
  for (const side of [-1, 1] as const) {
    if (layer === armLayer(s, side)) {
      rr(g, side * 13.6 - 1.6, -7, 3.2, 14, 1.6, '#1e293b')
      rr(g, side * 13.6 - 2.6, -8.4, 5.2, 4, 2, '#0f172a')
    }
  }
}

const logSeat: Painter = (g, s, layer) => {
  if (layer !== 'base') return
  const bark = s.color
  // stones that stop it rolling, then the trunk lying across the seat's facing
  ellipse(g, -16, 9.5, 3.4, 2.2, '#78716c')
  ellipse(g, 16, 9.5, 3.4, 2.2, '#78716c')
  rr(g, -22, -6, 44, 16.4, 8, shade(bark, -0.38))
  rr(g, -22, -8, 44, 16.4, 8, bark)
  g.fillStyle = 'rgba(255, 255, 255, 0.2)'
  g.beginPath()
  g.roundRect(-18, -6.6, 36, 3.6, 2)
  g.fill()
  g.fillStyle = 'rgba(0, 0, 0, 0.22)'
  g.beginPath()
  g.roundRect(-19, 3.2, 38, 3.6, 2)
  g.fill()
  g.strokeStyle = shade(bark, -0.32)
  g.lineWidth = 1
  g.lineCap = 'round'
  for (const [bx, by, bl] of [[-14, -2, 9], [-2, 1, 12], [10, -3, 8], [-9, 4.4, 7], [6, 4.8, 10]] as const) {
    g.beginPath()
    g.moveTo(bx, by)
    g.lineTo(bx + bl, by)
    g.stroke()
  }
  // the sawn end, with its rings
  ellipse(g, -20.5, 0.2, 4.2, 8, shade('#d9b382', -0.1))
  g.strokeStyle = '#a97a47'
  g.lineWidth = 0.9
  for (const k of [0.62, 0.3]) {
    g.beginPath()
    g.ellipse(-20.5, 0.2, 4.2 * k, 8 * k, 0, 0, TAU)
    g.stroke()
  }
  ellipse(g, 20.5, 0.2, 3.2, 7.4, shade(bark, -0.22))
}

const armchair: Painter = (g, s, layer) => {
  const c = s.color
  if (layer === 'base') {
    for (const sx of [-15.5, 11.5]) rr(g, sx, 16.5, 4.2, 4.6, 1.2, '#4a2c14')
  }
  if (layer === backLayer(s)) {
    rr(g, -16.5, -21, 33, 19, 8, shade(c, -0.3))
    rr(g, -16.5, -23, 33, 19, 8, shade(c, -0.1))
    rr(g, -12, -20.4, 24, 8, 4, 'rgba(255, 255, 255, 0.13)')
    g.strokeStyle = shade(c, 0.22)
    g.lineWidth = 1
    g.beginPath()
    g.roundRect(-14.5, -21.4, 29, 15, 6)
    g.stroke()
  }
  if (layer === 'base') {
    rr(g, -10.5, -3, 21, 21.6, 5.5, shade(c, -0.36))
    rr(g, -10.5, -6.4, 21, 21.6, 5.5, shade(c, 0.1))
    rr(g, -8, -5, 16, 7, 3.5, 'rgba(255, 255, 255, 0.18)')
    g.strokeStyle = shade(c, -0.18)
    g.lineWidth = 0.9
    g.beginPath()
    g.moveTo(0, 5)
    g.lineTo(0, 13)
    g.stroke()
  }
  for (const side of [-1, 1] as const) {
    if (layer === armLayer(s, side)) {
      const x = side < 0 ? -20.4 : 11.2
      rr(g, x, -10.5, 9.2, 28.4, 5, shade(c, -0.34))
      rr(g, x, -12.5, 9.2, 28.4, 5, shade(c, -0.06))
      rr(g, x + 1.6, -11.2, 6, 5, 2.5, 'rgba(255, 255, 255, 0.2)')
    }
  }
}

/** The beach bed. Long axis is y: head (pillow, raised back rest) at -y, feet at +y. People LIE on it. */
const lounger: Painter = (g, s, layer) => {
  if (layer !== 'base') return
  const c = s.color
  const wood = '#8f5b2e'
  // foot-end legs, then the two rails
  rr(g, -12.5, 18.5, 3.4, 5, 1, shade(wood, -0.3))
  rr(g, 9.1, 18.5, 3.4, 5, 1, shade(wood, -0.3))
  for (const rx of [-13, 9.6]) {
    rr(g, rx, -22.5, 3.6, 45, 1.8, shade(wood, -0.2))
    rr(g, rx, -23.4, 3.6, 45, 1.8, wood)
    g.fillStyle = 'rgba(255, 255, 255, 0.22)'
    g.fillRect(rx + 0.8, -22, 0.9, 42)
  }
  // the sling: striped canvas. The head end is the raised back rest, a touch lighter, with a fold line.
  rr(g, -10.5, -22, 21, 44, 4, shade(c, -0.4))
  rr(g, -10.5, -23, 21, 44, 4, c)
  g.save()
  g.beginPath()
  g.roundRect(-10.5, -23, 21, 44, 4)
  g.clip()
  g.fillStyle = 'rgba(255, 255, 255, 0.8)'
  for (let y = -17; y < 21; y += 9) g.fillRect(-11, y, 22, 4.4)
  g.fillStyle = 'rgba(255, 255, 255, 0.13)'
  g.fillRect(-11, -23, 22, 17)
  g.restore()
  g.fillStyle = 'rgba(0, 0, 0, 0.2)'
  g.fillRect(-10.5, -6.4, 21, 1.8)
  // pillow and a rolled towel at the feet
  rr(g, -7.5, -21.6, 15, 7.6, 3.4, '#e2e8f0')
  rr(g, -7.5, -22.2, 15, 7.6, 3.4, '#f8fafc')
  g.fillStyle = 'rgba(15, 23, 42, 0.08)'
  g.fillRect(-5, -18.6, 10, 0.8)
  rr(g, -9, 17.4, 18, 4.4, 2.2, shade(c, -0.15))
  rr(g, -9, 16.8, 18, 4.4, 2.2, shade(c, 0.1))
  g.fillStyle = 'rgba(255, 255, 255, 0.5)'
  g.fillRect(-5, 17.8, 10, 1)
}

const zabuton: Painter = (g, s, layer) => {
  if (layer !== 'base') return
  const c = s.color
  const k = s.taken ? 0.93 : 1
  g.save()
  g.scale(k, k)
  ellipse(g, 0, 13.4, 16, 4, 'rgba(15, 23, 42, 0.2)')
  rr(g, -15.5, -9, 31, 28, 7, shade(c, -0.36))
  rr(g, -15.5, -12.5, 31, 28, 7, shade(c, 0.04))
  g.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  g.lineWidth = 1.1
  g.setLineDash([3, 2.4])
  g.beginPath()
  g.roundRect(-12, -9, 24, 21.4, 4.4)
  g.stroke()
  g.setLineDash([])
  if (s.taken) ellipse(g, 0, 2, 8, 6, 'rgba(0, 0, 0, 0.18)')
  else circle(g, 0, 1.7, 2.3, shade(c, -0.32))
  for (const [tx, ty] of [[-15, -12], [15, -12], [-15, 15], [15, 15]] as const) circle(g, tx, ty, 2.5, shade(c, -0.26))
  g.restore()
}

/** `sofa_cushion` paints nothing on purpose: the sofa under it (furniture.ts) already draws the cushions. */
const PAINTERS: Record<string, Painter> = {
  bench,
  stool,
  beanbag,
  office_chair: officeChair,
  log_seat: logSeat,
  armchair,
  deck_chair: lounger,
  zabuton,
}

/** Parts that stand on the floor and must not turn with the seat: a swivel chair's castors always point down the screen. */
const GROUND: Record<string, (g: Ctx) => void> = {
  office_chair: (g) => {
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * TAU) / 5
      const ex = Math.cos(a) * 12.5
      const ey = 12 + Math.sin(a) * 5.4
      line(g, 0, 12, ex, ey, shade(IRON, -0.2), 2.4)
      circle(g, ex, ey + 1.2, 2.3, '#0f172a')
    }
  },
}

/** Only seats with a front turn to face their direction; a round stool or a cushion looks the same from everywhere. */
const TURNS = new Set(['bench', 'office_chair', 'log_seat', 'armchair', 'deck_chair'])

/** Soft shadow on the ground, in screen space (it must not turn with the seat). */
function seatShadow(g: Ctx, s: Seat) {
  switch (s.style) {
    case 'bench':
      shadow(g, 0, 17, s.join?.left || s.join?.right ? 24 : 22, 4.6, 0.26)
      break
    case 'deck_chair':
      g.fillStyle = 'rgba(15, 23, 42, 0.22)'
      g.beginPath()
      if (s.dir === 'left' || s.dir === 'right') g.ellipse(0, 3, 25, 12.5, 0, 0, TAU)
      else g.ellipse(0, 3, 14, 24, 0, 0, TAU)
      g.fill()
      break
    case 'stool':
      shadow(g, 0, 18.6, 13.5, 4.2, 0.26)
      break
    case 'beanbag':
      shadow(g, 0, 18, s.taken ? 20 : 17.5, 5.2, 0.28)
      break
    case 'office_chair':
      shadow(g, 0, 19, 15, 4.4, 0.24)
      break
    case 'log_seat':
      shadow(g, 0, 12, 22.5, 4.6, 0.26)
      break
    case 'armchair':
      shadow(g, 0, 20, 21, 5, 0.26)
      break
  }
}

const sprite = bakedSprite(TILE, TILE, 8)

/** Paint one pass of a seat at its tile. Seats never change except `taken`, so every distinct look is painted once. */
export function paintSeat(g: Ctx, p: Prop, layer: SeatLayer) {
  const s = p.seat
  if (!s) return
  const painter = PAINTERS[s.style]
  if (!painter) return
  const key = `${s.style}|${TURNS.has(s.style) ? s.dir : ''}|${s.color}|${s.join?.left ? 'L' : ''}${s.join?.right ? 'R' : ''}|${s.taken ? 1 : 0}|${layer}`
  sprite(g, p.col * TILE, p.row * TILE, key, (sg) => {
    sg.translate(TILE / 2, TILE / 2)
    if (layer === 'base') {
      seatShadow(sg, s)
      GROUND[s.style]?.(sg)
    }
    if (TURNS.has(s.style)) sg.rotate(SEAT_ANGLE[s.dir])
    painter(sg, s, layer)
  })
}

export const drawSeat = (g: Ctx, p: Prop) => paintSeat(g, p, 'base')
export const drawSeatFront = (g: Ctx, p: Prop) => paintSeat(g, p, 'front')
