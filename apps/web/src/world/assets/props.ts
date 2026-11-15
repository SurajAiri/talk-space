/**
 * PROP ASSET PACK: everything that can be placed ON TOP of tiles.
 *
 * To add a prop: write its draw function (pixel coordinates; the prop's top-left is
 * p.col * TILE, p.row * TILE and it covers p.w x p.h tiles) and add ONE entry to
 * PROP_CATALOG. Nothing else needs to change: the editor palette, the map validator,
 * the CLI and the file format all read this list.
 *
 * Pure data + canvas calls, no DOM or app imports, so the whole `assets/` folder can be
 * copied into another project (together with `../types.ts`).
 */
import { TILE, type Dir, type Prop } from '../types.ts'

export type PropResize = 'none' | 'w' | 'wh'

export interface PropDef {
  type: string
  label: string
  /** default size in tiles */
  w: number
  h: number
  /** blocks walking */
  solid: boolean
  /** which dimensions the editor / validator allow to differ from the default */
  resize: PropResize
  minW?: number
  minH?: number
  /** optional named looks, stored as `variant` in the map file; first one is the default */
  variants?: readonly string[]
  /** default tint. Present = this prop can be tinted with `color` in the map file */
  color?: string
  /** internal types (seats) are created through their own list, not the props palette */
  hidden?: boolean
  draw: (g: CanvasRenderingContext2D, p: Prop, time: number) => void
  /**
   * Lamps, glowing signs, embers: calls `emit` once per pool of light this prop throws. The pools are added on
   * top of the finished scene (render/scene.ts, drawNight), so a dark tile under a lantern really gets brighter.
   */
  light?: (p: Prop, time: number, emit: EmitLight) => void
  /** Drawn ABOVE people, after the depth-sorted pass: string lights, canopies. Things you walk underneath. */
  overhead?: (g: CanvasRenderingContext2D, p: Prop, time: number) => void
}

/** A soft pool of coloured light in world pixels. `rgb` is "r, g, b"; `a` is its strength, 0..1. */
export interface Light {
  x: number
  y: number
  r: number
  rgb: string
  a: number
}
export type EmitLight = (l: Light) => void

function drawFountain(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE;
  const cy = y + TILE;
  g.fillStyle = '#64748b';
  g.beginPath();
  g.arc(cx, cy, 42, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#38bdf8';
  g.beginPath();
  g.arc(cx, cy, 34, 0, Math.PI * 2);
  g.fill();
  const r1 = 12 + ((time * 0.02) % 20);
  g.strokeStyle = 'rgba(255,255,255,0.65)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, r1, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#e2e8f0';
  g.beginPath();
  g.arc(cx, cy, 10, 0, Math.PI * 2);
  g.fill();
}

function drawTree(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  const sway = Math.sin(time * 0.0025 + p.col) * 2;
  g.fillStyle = 'rgba(15, 23, 42, 0.28)';
  g.beginPath();
  g.ellipse(cx, cy + 16, 22, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#78350f';
  g.fillRect(cx - 6, cy - 4, 12, 20);
  const isSakura = p.variant === 'sakura';
  g.fillStyle = isSakura ? '#f472b6' : '#15803d';
  g.beginPath();
  g.arc(cx + sway, cy - 18, 24, 0, Math.PI * 2);
  g.arc(cx - 14 + sway, cy - 10, 17, 0, Math.PI * 2);
  g.arc(cx + 14 + sway, cy - 10, 17, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = isSakura ? '#fbcfe8' : '#22c55e';
  g.beginPath();
  g.arc(cx - 4 + sway, cy - 23, 14, 0, Math.PI * 2);
  g.fill();
}

function drawCampfire(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  g.fillStyle = '#451a03';
  g.fillRect(cx - 16, cy - 4, 32, 8);
  g.fillRect(cx - 4, cy - 16, 8, 32);
  g.strokeStyle = '#94a3b8';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(cx, cy, 18, 0, Math.PI * 2);
  g.stroke();
  const flicker = Math.sin(time * 0.02) * 3;
  g.fillStyle = '#f97316';
  g.beginPath();
  g.arc(cx, cy - 2, 12 + flicker * 0.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fde047';
  g.beginPath();
  g.arc(cx, cy - 4, 7 - flicker * 0.2, 0, Math.PI * 2);
  g.fill();
}

function drawLantern(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  g.fillStyle = '#334155';
  g.fillRect(cx - 3, cy - 18, 6, 30);
  g.fillStyle = '#fef08a';
  g.beginPath();
  g.arc(cx, cy - 20, 8, 0, Math.PI * 2);
  g.fill();
}

function drawCafeCounter(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = '#78350f';
  g.beginPath();
  g.roundRect(x + 2, y + 6, p.w * TILE - 4, TILE - 8, 6);
  g.fill();
  g.fillStyle = '#f8fafc';
  g.fillRect(x + 6, y + 8, p.w * TILE - 12, 14);
  g.fillStyle = '#dc2626';
  g.fillRect(x + 18, y + 4, 24, 18);
  g.fillStyle = '#f59e0b';
  g.beginPath();
  g.arc(x + 90, y + 16, 6, 0, Math.PI * 2);
  g.arc(x + 106, y + 16, 6, 0, Math.PI * 2);
  g.fill();
}

function drawBookshelf(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = '#94a3b8';
  g.fillRect(x + 2, y + 2, p.w * TILE - 4, TILE - 6);
  const bookColors = ['#ef4444', '#3b82f6', '#10b981', '#eab308', '#a855f7'];
  for (let b = 8; b < p.w * TILE - 12; b += 10) {
    g.fillStyle = bookColors[(b / 10) % bookColors.length];
    g.fillRect(x + b, y + 10, 7, 14);
    g.fillRect(x + b, y + 28, 7, 12);
  }
}

function drawSofaHoriz(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = p.color || '#f59e0b';
  g.beginPath();
  g.roundRect(x + 2, y + 4, p.w * TILE - 4, TILE - 8, 8);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.fillRect(x + 4, y + 4, p.w * TILE - 8, 10);
}

function drawRoundTable(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  g.fillStyle = p.type === 'round_table' ? '#e2b887' : '#334155';
  g.beginPath();
  g.ellipse(cx, cy, 22, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  g.stroke();
}

function drawPingpong(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = '#10b981';
  g.fillRect(x + 6, y + 6, p.w * TILE - 12, p.h * TILE - 12);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.strokeRect(x + 8, y + 8, p.w * TILE - 16, p.h * TILE - 16);
  g.beginPath();
  g.moveTo(x + p.w * TILE / 2, y + 8);
  g.lineTo(x + p.w * TILE / 2, y + p.h * TILE - 8);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(x + 4, y + (p.h * TILE) / 2 - 2, p.w * TILE - 8, 4);
}

function drawArcade(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = '#1e293b';
  g.fillRect(x + 8, y + 4, TILE - 16, TILE - 8);
  g.fillStyle = p.color || '#06b6d4';
  g.fillRect(x + 12, y + 10, TILE - 24, 16);
}

function drawDeskPod(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = '#f8fafc';
  g.beginPath();
  g.roundRect(x + 2, y + 10, p.w * TILE - 4, TILE - 14, 4);
  g.fill();
  g.fillStyle = '#1e293b';
  g.fillRect(x + 12, y + 14, 24, 14);
  g.fillRect(x + 56, y + 14, 24, 14);
  g.fillStyle = '#38bdf8';
  g.fillRect(x + 14, y + 16, 20, 10);
  g.fillRect(x + 58, y + 16, 20, 10);
}

function drawPicnicTable(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = '#b45309';
  g.beginPath();
  g.roundRect(x + 4, y + 8, p.w * TILE - 8, TILE - 16, 4);
  g.fill();
}

function drawPlant(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  g.fillStyle = '#475569';
  g.beginPath();
  g.arc(cx, cy + 8, 11, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#22c55e';
  g.beginPath();
  g.arc(cx, cy - 2, 13, 0, Math.PI * 2);
  g.arc(cx - 8, cy + 2, 9, 0, Math.PI * 2);
  g.arc(cx + 8, cy + 2, 9, 0, Math.PI * 2);
  g.fill();
}

/** Rotation that turns a "faces down" drawing to face each direction. */
const SEAT_ANGLE: Record<Dir, number> = { down: 0, left: Math.PI / 2, up: Math.PI, right: -Math.PI / 2 }

function drawSeat(g: CanvasRenderingContext2D, p: Prop) {
  const s = p.seat
  if (!s) return
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  if (s.style === 'beanbag') {
    g.fillStyle = s.color;
    g.beginPath();
    g.arc(cx, cy + 2, 15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath();
    g.arc(cx - 4, cy - 2, 6, 0, Math.PI * 2);
    g.fill();
  } else if (s.style === 'bench' || s.style === 'log_seat') {
    g.fillStyle = s.color;
    g.beginPath();
    g.roundRect(x + 8, y + 12, TILE - 16, TILE - 24, 6);
    g.fill();
  } else if (s.style === 'stool' || s.style === 'office_chair') {
    g.fillStyle = s.color;
    g.beginPath();
    g.arc(cx, cy + 4, 11, 0, Math.PI * 2);
    g.fill();
  } else if (s.style === 'armchair') {
    // faces s.dir, so the back is on the opposite side (rotate a "facing down" drawing)
    g.save()
    g.translate(cx, cy)
    g.rotate(SEAT_ANGLE[s.dir])
    g.fillStyle = 'rgba(15, 23, 42, 0.25)'
    g.beginPath()
    g.ellipse(0, 17, 17, 5, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = s.color
    g.beginPath()
    g.roundRect(-16, -17, 32, 33, 7)
    g.fill()
    g.fillStyle = 'rgba(0, 0, 0, 0.28)'
    g.beginPath()
    g.roundRect(-16, -17, 32, 11, 6)
    g.fill()
    g.beginPath()
    g.roundRect(-18, -8, 7, 24, 4)
    g.roundRect(11, -8, 7, 24, 4)
    g.fill()
    g.fillStyle = 'rgba(255, 255, 255, 0.2)'
    g.beginPath()
    g.roundRect(-9, -3, 18, 15, 5)
    g.fill()
    g.restore()
  } else if (s.style === 'deck_chair') {
    g.save()
    g.translate(cx, cy)
    g.rotate(SEAT_ANGLE[s.dir])
    g.fillStyle = 'rgba(15, 23, 42, 0.22)'
    g.beginPath()
    g.ellipse(2, 21, 14, 4, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#e2e8f0'
    g.beginPath()
    g.roundRect(-11, -21, 22, 42, 4)
    g.fill()
    g.fillStyle = s.color
    for (let sy = -19; sy < 19; sy += 10) g.fillRect(-11, sy, 22, 5)
    g.fillStyle = '#92400e'
    g.fillRect(-13, -22, 3, 44)
    g.fillRect(10, -22, 3, 44)
    g.fillStyle = '#f8fafc'
    g.beginPath()
    g.roundRect(-8, -20, 16, 8, 3)
    g.fill()
    g.restore()
  } else if (s.style === 'zabuton') {
    g.fillStyle = 'rgba(15, 23, 42, 0.22)'
    g.beginPath()
    g.ellipse(cx, cy + 15, 15, 4, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = s.color
    g.beginPath()
    g.roundRect(cx - 15, cy - 14, 30, 29, 6)
    g.fill()
    g.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    g.lineWidth = 1.5
    g.beginPath()
    g.roundRect(cx - 12, cy - 11, 24, 23, 4)
    g.stroke()
    g.fillStyle = 'rgba(0, 0, 0, 0.25)'
    g.beginPath()
    g.arc(cx, cy, 3, 0, Math.PI * 2)
    g.fill()
  }
}

// =============================================================================================
// EXTENDED PACK (Lodge / Zen Garden / Orbital maps)
// Same rules as above. Reminder: props are depth-sorted by their BOTTOM edge, which is why
// nothing here is a flat floor decal (it would paint over people standing on its last row);
// flat things (rugs, bridges) are tiles instead. Tall props may draw above their footprint.
// =============================================================================================

/** Deterministic noise in [0, 1) from a cell position (same helper as tiles.ts, kept local on purpose). */
function noise(c: number, r: number, k = 0): number {
  let h = Math.imul(c + 1013, 374761393) ^ Math.imul(r + 7919, 668265263) ^ Math.imul(k + 17, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function shadow(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, a = 0.28) {
  g.fillStyle = `rgba(15, 23, 42, ${a})`
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

function tri(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  g.beginPath()
  g.moveTo(ax, ay)
  g.lineTo(bx, by)
  g.lineTo(cx, cy)
  g.closePath()
  g.fill()
}

// ---- bake cache (same idea as tiles.ts) -------------------------------------------------------
// Props that are static and drawn many times per room (planter racks, bookcases) are painted once per
// instance into a bitmap and blitted. Falls back to direct drawing when no offscreen surface exists.
function bakedProp(paint: (g: CanvasRenderingContext2D, p: Prop, time: number) => void, headroom = 16) {
  const cache = new Map<string, CanvasImageSource>()
  return (g: CanvasRenderingContext2D, p: Prop, time: number) => {
    const m = typeof g.getTransform === 'function' ? g.getTransform() : null
    const k = Math.min(3, Math.max(1, Math.ceil((m ? Math.hypot(m.a, m.b) : 2) - 0.05)))
    const id = `${k}|${p.col},${p.row}|${p.w}x${p.h}|${p.variant ?? ''}|${p.color ?? ''}`
    let bmp = cache.get(id)
    const pw = p.w * TILE
    const ph = p.h * TILE + headroom
    if (!bmp) {
      const s = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(pw * k, ph * k) : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: pw * k, height: ph * k }) : null
      const sg = s?.getContext('2d') as CanvasRenderingContext2D | null | undefined
      if (!s || !sg) {
        paint(g, p, time)
        return
      }
      sg.scale(k, k)
      sg.translate(-p.col * TILE, -p.row * TILE + headroom)
      paint(sg, p, 0)
      cache.set(id, s)
      bmp = s
    }
    g.drawImage(bmp, p.col * TILE, p.row * TILE - headroom, pw, ph)
  }
}

function drawPine(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const cx = p.col * TILE + TILE / 2
  const by = (p.row + 1) * TILE - 4
  const sway = Math.sin(time * 0.002 + p.col * 1.3) * 1.6
  const dark = p.variant === 'dark'
  shadow(g, cx, by - 2, 21, 7)
  g.fillStyle = '#5b3a1e'
  g.fillRect(cx - 4, by - 16, 8, 16)
  const tiers = [[by - 12, 23, 34], [by - 30, 19, 32], [by - 47, 14, 30]] as const
  tiers.forEach(([base, hw, h], i) => {
    const ax = cx + sway * (i + 1) * 0.45
    g.fillStyle = dark ? '#0f3f26' : '#166534'
    tri(g, ax, base - h, cx - hw, base, cx + hw, base)
    g.fillStyle = dark ? '#16603a' : '#1f8a47'
    tri(g, ax, base - h, cx - hw, base, cx - 2, base)
  })
}

const MAPLE: Record<string, readonly [string, string, string]> = {
  red: ['#b91c1c', '#dc2626', '#fca5a5'],
  gold: ['#b45309', '#f59e0b', '#fde68a'],
  green: ['#15803d', '#22c55e', '#bbf7d0'],
}

function drawMaple(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const cx = p.col * TILE + TILE / 2
  const cy = p.row * TILE + TILE / 2
  const [dk, mid, hi] = MAPLE[p.variant ?? 'red'] ?? MAPLE.red!
  const sway = Math.sin(time * 0.0022 + p.col) * 1.8
  shadow(g, cx, cy + 16, 22, 9)
  g.fillStyle = '#6b4423'
  g.fillRect(cx - 5, cy - 2, 10, 20)
  g.fillStyle = dk
  g.beginPath()
  g.arc(cx + sway, cy - 18, 25, 0, Math.PI * 2)
  g.arc(cx - 16 + sway, cy - 8, 17, 0, Math.PI * 2)
  g.arc(cx + 16 + sway, cy - 8, 17, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = mid
  g.beginPath()
  g.arc(cx - 3 + sway, cy - 23, 18, 0, Math.PI * 2)
  g.arc(cx + 14 + sway, cy - 12, 11, 0, Math.PI * 2)
  g.arc(cx - 16 + sway, cy - 11, 10, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = hi
  g.beginPath()
  g.arc(cx - 9 + sway, cy - 29, 7, 0, Math.PI * 2)
  g.arc(cx + 8 + sway, cy - 26, 4, 0, Math.PI * 2)
  g.fill()
  const t = (time * 0.02 + p.col * 37 + p.row * 91) % 60
  g.fillStyle = hexA(mid, 1 - t / 60)
  g.beginPath()
  g.ellipse(cx + Math.sin(time * 0.002 + p.col) * 16, cy - 6 + t * 0.7, 3.2, 1.8, t * 0.1, 0, Math.PI * 2)
  g.fill()
}

function drawBush(g: CanvasRenderingContext2D, p: Prop) {
  const cx = p.col * TILE + TILE / 2
  const cy = p.row * TILE + TILE / 2
  shadow(g, cx, cy + 15, 19, 6)
  g.fillStyle = '#166534'
  g.beginPath()
  g.arc(cx - 9, cy + 4, 11, 0, Math.PI * 2)
  g.arc(cx + 9, cy + 4, 11, 0, Math.PI * 2)
  g.arc(cx, cy - 3, 13, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#22863a'
  g.beginPath()
  g.arc(cx - 4, cy - 5, 8, 0, Math.PI * 2)
  g.arc(cx + 10, cy + 1, 6, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#4ade80'
  g.fillRect(cx - 8, cy - 8, 4, 3)
  g.fillRect(cx + 6, cy - 2, 3, 3)
  if (p.variant === 'flowering') {
    const dots = [[-9, -2], [-2, -10], [7, -4], [11, 6], [-12, 8], [2, 4]] as const
    dots.forEach(([dx, dy], i) => {
      g.fillStyle = i % 2 === 0 ? '#f9a8d4' : '#fef3c7'
      g.beginPath()
      g.arc(cx + dx, cy + dy, 2.8, 0, Math.PI * 2)
      g.fill()
    })
  }
}

function drawRock(g: CanvasRenderingContext2D, p: Prop) {
  for (let i = 0; i < p.w; i++) {
    const c = p.col + i
    const cx = c * TILE + TILE / 2
    const cy = p.row * TILE + TILE / 2 + 5
    const s = 0.78 + noise(c, p.row, 1) * 0.34
    shadow(g, cx, cy + 11 * s, 20 * s, 6)
    g.fillStyle = '#707b89'
    g.beginPath()
    g.ellipse(cx, cy, 19 * s, 14 * s, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#9aa6b4'
    g.beginPath()
    g.ellipse(cx - 3 * s, cy - 4 * s, 13 * s, 8 * s, -0.2, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#c3ccd6'
    g.beginPath()
    g.ellipse(cx - 7 * s, cy - 7 * s, 5 * s, 2.6 * s, -0.4, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(30, 41, 59, 0.35)'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(cx + 2 * s, cy - 2 * s)
    g.lineTo(cx + 8 * s, cy + 6 * s)
    g.stroke()
    if (p.variant === 'mossy') {
      g.fillStyle = '#4d8f2f'
      g.beginPath()
      g.ellipse(cx - 1 * s, cy - 10 * s, 12 * s, 4.5 * s, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#7fc25a'
      g.beginPath()
      g.ellipse(cx - 4 * s, cy - 11 * s, 5 * s, 2 * s, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
}

function drawFirewood(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  shadow(g, x + 24, y + 38, 20, 5)
  g.fillStyle = '#5b3a1e'
  g.fillRect(x + 6, y + 14, 36, 24)
  const rows = [[3, 30], [4, 22], [3, 14]] as const
  rows.forEach(([n, ly], ri) => {
    for (let i = 0; i < n; i++) {
      const lx = x + 12 + i * 10 + (n === 4 ? -4 : 0) + (ri === 1 ? 1 : 0)
      g.fillStyle = '#7c4a24'
      g.beginPath()
      g.arc(lx + 4, y + ly, 6, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#d4a373'
      g.beginPath()
      g.arc(lx + 4, y + ly, 3.6, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#a16b3c'
      g.lineWidth = 1
      g.beginPath()
      g.arc(lx + 4, y + ly, 1.8, 0, Math.PI * 2)
      g.stroke()
    }
  })
}

function drawStoneLantern(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const cx = p.col * TILE + TILE / 2
  const by = (p.row + 1) * TILE - 3
  const flick = 0.5 + 0.5 * Math.sin(time * 0.01 + p.col * 2)
  g.fillStyle = `rgba(253, 224, 71, ${0.1 + flick * 0.05})`
  g.beginPath()
  g.arc(cx, by - 26, 30, 0, Math.PI * 2)
  g.fill()
  shadow(g, cx, by - 1, 17, 5)
  g.fillStyle = '#7d838d'
  g.fillRect(cx - 13, by - 6, 26, 6)
  g.fillStyle = '#9aa0aa'
  g.fillRect(cx - 4, by - 20, 8, 14)
  g.fillStyle = '#7d838d'
  g.fillRect(cx - 11, by - 24, 22, 5)
  g.fillStyle = '#a9afb9'
  g.fillRect(cx - 8, by - 38, 16, 14)
  g.fillStyle = flick > 0.5 ? '#fde68a' : '#fcd34d'
  g.fillRect(cx - 4, by - 35, 8, 8)
  g.fillStyle = '#6b717b'
  g.beginPath()
  g.moveTo(cx - 19, by - 38)
  g.lineTo(cx + 19, by - 38)
  g.lineTo(cx + 11, by - 49)
  g.lineTo(cx - 11, by - 49)
  g.closePath()
  g.fill()
  g.fillStyle = '#9aa0aa'
  g.fillRect(cx - 19, by - 39, 38, 3)
  g.beginPath()
  g.arc(cx, by - 52, 4, 0, Math.PI * 2)
  g.fill()
}

function drawBamboo(g: CanvasRenderingContext2D, p: Prop, time: number) {
  g.lineCap = 'round'
  for (let i = 0; i < p.w; i++) {
    const c = p.col + i
    const bx = c * TILE
    const by = (p.row + 1) * TILE - 4
    shadow(g, bx + 24, by - 2, 21, 6)
    for (let k = 0; k < 4; k++) {
      const sx = bx + 7 + k * 11 + noise(c, p.row, k) * 4
      const hgt = 64 + noise(c, p.row, k + 5) * 26
      const sw = Math.sin(time * 0.002 + c + k) * 1.8
      g.strokeStyle = k % 2 === 0 ? '#7cb518' : '#65a30d'
      g.lineWidth = 5
      g.beginPath()
      g.moveTo(sx, by)
      g.lineTo(sx + sw, by - hgt)
      g.stroke()
      g.strokeStyle = '#3f6212'
      g.lineWidth = 1.5
      for (let n = 14; n < hgt; n += 16) {
        g.beginPath()
        g.moveTo(sx - 3 + (sw * n) / hgt, by - n)
        g.lineTo(sx + 3 + (sw * n) / hgt, by - n)
        g.stroke()
      }
      g.fillStyle = k % 2 === 0 ? '#4d7c0f' : '#65a30d'
      for (let l = 0; l < 3; l++) {
        g.beginPath()
        g.ellipse(sx + sw + (l - 1) * 8, by - hgt + 6 + l * 6, 9, 2.6, (l - 1) * 0.5, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  g.lineCap = 'butt'
}

function drawTorii(g: CanvasRenderingContext2D, p: Prop) {
  const col = p.color || '#d6361f'
  const x1 = (p.col + 0.5) * TILE
  const x2 = (p.col + p.w - 0.5) * TILE
  const mid = (x1 + x2) / 2
  const by = (p.row + 1) * TILE - 4
  shadow(g, x1, by, 14, 5)
  shadow(g, x2, by, 14, 5)
  g.fillStyle = col
  g.fillRect(x1 - 6, by - 106, 12, 106)
  g.fillRect(x2 - 6, by - 106, 12, 106)
  g.fillStyle = 'rgba(255, 255, 255, 0.18)'
  g.fillRect(x1 - 6, by - 106, 3, 106)
  g.fillRect(x2 - 6, by - 106, 3, 106)
  g.fillStyle = '#1f2937'
  g.fillRect(x1 - 7, by - 12, 14, 12)
  g.fillRect(x2 - 7, by - 12, 14, 12)
  g.fillStyle = col
  g.fillRect(x1 - 6, by - 76, x2 - x1 + 12, 8)
  g.fillRect(x1 - 20, by - 104, x2 - x1 + 40, 7)
  g.fillStyle = '#1f2937'
  g.beginPath()
  g.moveTo(x1 - 30, by - 122)
  g.quadraticCurveTo(mid, by - 112, x2 + 30, by - 122)
  g.lineTo(x2 + 22, by - 105)
  g.quadraticCurveTo(mid, by - 97, x1 - 22, by - 105)
  g.closePath()
  g.fill()
  g.fillStyle = '#374151'
  g.fillRect(mid - 7, by - 96, 14, 20)
  g.fillStyle = '#fbbf24'
  g.fillRect(mid - 4, by - 92, 8, 2)
  g.fillRect(mid - 4, by - 86, 8, 2)
}

function drawShrine(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const w = p.w * TILE
  const h = p.h * TILE
  shadow(g, x + w / 2, y + h - 3, w * 0.46, 8)
  g.fillStyle = '#a8a29e'
  g.fillRect(x + 6, y + h - 30, w - 12, 26)
  g.fillStyle = '#d6d3d1'
  g.fillRect(x + 6, y + h - 30, w - 12, 6)
  g.fillRect(x + w / 2 - 18, y + h - 22, 36, 18)
  g.fillStyle = '#a8a29e'
  g.fillRect(x + w / 2 - 18, y + h - 14, 36, 2)
  g.fillRect(x + w / 2 - 18, y + h - 8, 36, 2)
  g.fillStyle = '#f5f5f4'
  g.fillRect(x + 22, y + 32, w - 44, 36)
  g.fillStyle = '#292524'
  g.fillRect(x + w / 2 - 15, y + 40, 30, 28)
  g.fillStyle = '#57534e'
  for (let i = 0; i < 4; i++) g.fillRect(x + w / 2 - 15 + i * 8, y + 40, 2, 28)
  g.fillStyle = '#b91c1c'
  g.fillRect(x + 18, y + 30, 9, 40)
  g.fillRect(x + w - 27, y + 30, 9, 40)
  g.fillRect(x + w / 2 - 20, y + 30, 5, 38)
  g.fillRect(x + w / 2 + 15, y + 30, 5, 38)
  g.fillStyle = '#44403c'
  g.beginPath()
  g.moveTo(x + 2, y + 36)
  g.lineTo(x + w - 2, y + 36)
  g.lineTo(x + w - 20, y + 10)
  g.lineTo(x + 20, y + 10)
  g.closePath()
  g.fill()
  g.fillStyle = '#6b6560'
  g.fillRect(x + 20, y + 6, w - 40, 6)
  g.fillStyle = 'rgba(255, 255, 255, 0.12)'
  g.fillRect(x + 2, y + 34, w - 4, 2)
  g.fillStyle = '#fbbf24'
  g.beginPath()
  g.arc(x + 20, y + 8, 4, 0, Math.PI * 2)
  g.arc(x + w - 20, y + 8, 4, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#78350f'
  g.fillRect(x + w / 2 - 13, y + h - 36, 26, 9)
  g.fillStyle = '#92400e'
  g.fillRect(x + w / 2 - 13, y + h - 36, 26, 3)
}

function drawTent(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const col = p.color || '#f97316'
  shadow(g, x + 48, y + 87, 44, 9)
  g.strokeStyle = 'rgba(30, 20, 10, 0.5)'
  g.lineWidth = 1.2
  g.beginPath()
  g.moveTo(x + 10, y + 82)
  g.lineTo(x - 2, y + 92)
  g.moveTo(x + 86, y + 82)
  g.lineTo(x + 98, y + 92)
  g.stroke()
  g.fillStyle = col
  tri(g, x + 48, y + 8, x + 6, y + 86, x + 90, y + 86)
  g.fillStyle = 'rgba(255, 255, 255, 0.16)'
  tri(g, x + 48, y + 8, x + 6, y + 86, x + 30, y + 86)
  g.fillStyle = 'rgba(0, 0, 0, 0.2)'
  tri(g, x + 48, y + 8, x + 90, y + 86, x + 52, y + 86)
  g.fillStyle = '#1c1917'
  tri(g, x + 48, y + 34, x + 31, y + 86, x + 65, y + 86)
  g.fillStyle = 'rgba(0, 0, 0, 0.25)'
  tri(g, x + 48, y + 34, x + 56, y + 86, x + 65, y + 86)
  g.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  g.lineWidth = 1.5
  g.beginPath()
  g.moveTo(x + 48, y + 8)
  g.lineTo(x + 48, y + 34)
  g.stroke()
  g.fillStyle = '#e5e7eb'
  g.fillRect(x + 46, y + 4, 4, 6)
}

function drawRowboat(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const col = p.color || '#b45309'
  const cx = x + p.w * TILE / 2
  const cy = y + TILE / 2
  const bob = Math.sin(time * 0.002 + p.col) * 1.2
  const ph = (time * 0.0007) % 1
  g.strokeStyle = `rgba(255, 255, 255, ${0.35 * (1 - ph)})`
  g.lineWidth = 1.5
  g.beginPath()
  g.ellipse(cx, cy + 3 + bob, 44 + ph * 6, 16 + ph * 3, 0, 0, Math.PI * 2)
  g.stroke()
  shadow(g, cx, cy + 9 + bob, 40, 7, 0.22)
  g.fillStyle = col
  g.beginPath()
  g.moveTo(cx - 40, cy - 11 + bob)
  g.quadraticCurveTo(cx + 30, cy - 18 + bob, cx + 46, cy + 2 + bob)
  g.quadraticCurveTo(cx + 30, cy + 18 + bob, cx - 40, cy + 11 + bob)
  g.closePath()
  g.fill()
  g.fillStyle = 'rgba(0, 0, 0, 0.32)'
  g.beginPath()
  g.moveTo(cx - 35, cy - 7 + bob)
  g.quadraticCurveTo(cx + 26, cy - 12 + bob, cx + 36, cy + 2 + bob)
  g.quadraticCurveTo(cx + 26, cy + 12 + bob, cx - 35, cy + 7 + bob)
  g.closePath()
  g.fill()
  g.fillStyle = 'rgba(255, 255, 255, 0.22)'
  for (const tx of [-18, 2, 20]) g.fillRect(cx + tx, cy - 9 + bob, 4, 18)
  g.strokeStyle = '#d6d3d1'
  g.lineWidth = 2.5
  g.beginPath()
  g.moveTo(cx - 6, cy - 6 + bob)
  g.lineTo(cx - 20, cy - 24 + bob)
  g.moveTo(cx - 6, cy + 6 + bob)
  g.lineTo(cx - 20, cy + 22 + bob)
  g.stroke()
}

function drawHotTub(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const w = p.w * TILE
  const h = p.h * TILE
  const stone = p.variant === 'stone'
  shadow(g, x + w / 2, y + h - 2, w * 0.44, 8)
  g.fillStyle = stone ? '#6f6963' : '#92400e'
  g.beginPath()
  g.roundRect(x + 3, y + 3, w - 6, h - 6, 18)
  g.fill()
  if (stone) {
    g.fillStyle = '#a8a29e'
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      g.beginPath()
      g.ellipse(x + w / 2 + Math.cos(a) * (w / 2 - 9), y + h / 2 + Math.sin(a) * (h / 2 - 9), 7, 5.5, a, 0, Math.PI * 2)
      g.fill()
    }
  } else {
    g.fillStyle = 'rgba(0, 0, 0, 0.22)'
    for (let i = 10; i < w - 6; i += 12) g.fillRect(x + i, y + 4, 1.6, 9)
    g.fillStyle = 'rgba(255, 220, 170, 0.2)'
    g.fillRect(x + 8, y + 4, w - 16, 2)
  }
  g.fillStyle = '#38bdf8'
  g.beginPath()
  g.roundRect(x + 12, y + 12, w - 24, h - 24, 12)
  g.fill()
  g.fillStyle = '#7dd3fc'
  g.beginPath()
  g.roundRect(x + 16, y + 16, w - 32, h - 36, 10)
  g.fill()
  const ph = (time * 0.0006) % 1
  g.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - ph)})`
  g.lineWidth = 2
  g.beginPath()
  g.ellipse(x + w / 2, y + h / 2, 8 + ph * (w / 2 - 20), 5 + ph * (h / 2 - 20), 0, 0, Math.PI * 2)
  g.stroke()
  for (let i = 0; i < 3; i++) {
    const t = ((time * 0.0004 + i / 3) % 1)
    g.fillStyle = `rgba(255, 255, 255, ${0.35 * (1 - t)})`
    g.beginPath()
    g.arc(x + w / 2 + (i - 1) * 16 + Math.sin(t * 6 + i) * 4, y + h / 2 - t * 34, 7 + t * 7, 0, Math.PI * 2)
    g.fill()
  }
}

function drawFireplace(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const w = p.w * TILE
  const cx = x + w / 2
  g.fillStyle = `rgba(251, 146, 60, ${0.1 + 0.04 * Math.sin(time * 0.012)})`
  g.beginPath()
  g.ellipse(cx, y + TILE + 6, w * 0.45, 20, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#78716c'
  g.fillRect(x + 4, y - 14, w - 8, TILE + 12)
  g.fillStyle = '#a8a29e'
  g.fillRect(x + 4, y - 14, w - 8, 4)
  g.strokeStyle = 'rgba(41, 37, 36, 0.35)'
  g.lineWidth = 1.2
  for (let ry = y - 4; ry < y + TILE; ry += 10) {
    g.beginPath()
    g.moveTo(x + 4, ry)
    g.lineTo(x + w - 4, ry)
    g.stroke()
    for (let rx = x + 10 + ((ry / 10) % 2) * 9; rx < x + w - 4; rx += 18) {
      g.beginPath()
      g.moveTo(rx, ry)
      g.lineTo(rx, ry + 10)
      g.stroke()
    }
  }
  g.fillStyle = '#5c3d1e'
  g.fillRect(x, y - 6, w, 8)
  g.fillStyle = '#7c5428'
  g.fillRect(x, y - 6, w, 3)
  const hw = Math.min(w - 36, 60)
  g.fillStyle = '#1c1917'
  g.beginPath()
  g.roundRect(cx - hw / 2, y + 8, hw, TILE - 12, [14, 14, 0, 0])
  g.fill()
  for (let i = 0; i < 3; i++) {
    const f = Math.sin(time * 0.014 + i * 2.1)
    const fx = cx + (i - 1) * (hw / 4)
    g.fillStyle = '#f97316'
    g.beginPath()
    g.moveTo(fx - 8, y + TILE - 4)
    g.quadraticCurveTo(fx - 8 + f, y + 24, fx + f * 2, y + 14 + f * 2)
    g.quadraticCurveTo(fx + 8, y + 24, fx + 8, y + TILE - 4)
    g.fill()
    g.fillStyle = '#fde047'
    g.beginPath()
    g.moveTo(fx - 4, y + TILE - 4)
    g.quadraticCurveTo(fx - 4, y + 30, fx + f, y + 24)
    g.quadraticCurveTo(fx + 4, y + 30, fx + 4, y + TILE - 4)
    g.fill()
  }
  g.fillStyle = '#44260f'
  g.fillRect(cx - hw / 2 + 4, y + TILE - 6, hw - 8, 5)
}

function drawBookcase(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const w = p.w * TILE
  const books = ['#dc2626', '#2563eb', '#16a34a', '#eab308', '#9333ea', '#0891b2', '#ea580c']
  g.fillStyle = '#4a2c14'
  g.fillRect(x + 1, y - 12, w - 2, TILE + 8)
  g.fillStyle = '#7c4a24'
  g.fillRect(x + 1, y - 12, w - 2, 4)
  for (const [i, sy] of [[0, y - 5], [1, y + 17]] as const) {
    g.fillStyle = '#2a1708'
    g.fillRect(x + 4, sy, w - 8, 20)
    let bx = x + 6
    let n = 0
    while (bx < x + w - 10) {
      const bw = 4 + Math.floor(noise(p.col + n, p.row + i, 1) * 4)
      const bh = 12 + Math.floor(noise(p.col + n, p.row + i, 2) * 6)
      g.fillStyle = books[Math.floor(noise(p.col + n, p.row + i, 3) * books.length)]!
      g.fillRect(bx, sy + 20 - bh, bw, bh)
      g.fillStyle = 'rgba(255, 255, 255, 0.25)'
      g.fillRect(bx, sy + 20 - bh, 1.2, bh)
      bx += bw + 1
      n++
    }
    g.fillStyle = '#7c4a24'
    g.fillRect(x + 3, sy + 20, w - 6, 3)
  }
}

function drawLowTable(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const w = p.w * TILE
  shadow(g, x + w / 2, y + 38, w / 2 - 6, 6)
  g.fillStyle = '#4a2c14'
  g.beginPath()
  g.roundRect(x + 6, y + 10, w - 12, 28, 6)
  g.fill()
  g.fillStyle = '#7c2d12'
  g.beginPath()
  g.roundRect(x + 6, y + 8, w - 12, 26, 6)
  g.fill()
  g.fillStyle = 'rgba(255, 255, 255, 0.14)'
  g.fillRect(x + 12, y + 10, w - 24, 3)
  g.fillStyle = '#fef3c7'
  for (const cx of [x + 16, x + w - 16]) {
    g.beginPath()
    g.arc(cx, y + 22, 5, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#b45309'
    g.beginPath()
    g.arc(cx, y + 22, 3, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#fef3c7'
  }
  g.fillStyle = '#0f766e'
  g.beginPath()
  g.ellipse(x + w / 2, y + 22, 8, 6, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#14b8a6'
  g.fillRect(x + w / 2 - 2, y + 14, 4, 4)
}

function drawConsole(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const col = p.color || '#22d3ee'
  shadow(g, x + 24, y + 42, 19, 4)
  g.fillStyle = '#1e293b'
  g.beginPath()
  g.roundRect(x + 4, y + 22, TILE - 8, 20, 5)
  g.fill()
  g.fillStyle = '#334155'
  g.fillRect(x + 6, y + 22, TILE - 12, 4)
  g.fillStyle = '#0b1220'
  g.beginPath()
  g.roundRect(x + 7, y + 2, TILE - 14, 22, 3)
  g.fill()
  g.fillStyle = hexA(col, 0.16)
  g.fillRect(x + 9, y + 4, TILE - 18, 18)
  g.fillStyle = col
  for (let i = 0; i < 3; i++) {
    const wv = 6 + (Math.sin(time * 0.003 + i * 1.7 + p.col + p.row) + 1) * 7
    g.fillRect(x + 11, y + 7 + i * 5, wv, 2.4)
  }
  g.fillStyle = '#475569'
  g.fillRect(x + 8, y + 31, TILE - 16, 7)
  const keys = ['#f43f5e', '#facc15', col, '#a3e635']
  keys.forEach((k, i) => {
    g.fillStyle = k
    g.fillRect(x + 11 + i * 7, y + 33, 4, 3)
  })
}

function drawHoloTable(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const col = p.color || '#38bdf8'
  const cx = x + TILE
  const cy = y + TILE + 14
  shadow(g, cx, cy + 20, 42, 9)
  g.fillStyle = '#1e293b'
  g.beginPath()
  g.ellipse(cx, cy + 8, 40, 24, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#334155'
  g.beginPath()
  g.ellipse(cx, cy, 40, 24, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = hexA(col, 0.9)
  g.lineWidth = 2.5
  g.beginPath()
  g.ellipse(cx, cy, 30, 17, 0, 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = hexA(col, 0.18)
  g.beginPath()
  g.ellipse(cx, cy, 30, 17, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = hexA(col, 0.1)
  tri(g, cx - 16, cy - 2, cx + 16, cy - 2, cx, cy - 44)
  const gy = cy - 34
  g.strokeStyle = hexA(col, 0.95)
  g.lineWidth = 1.6
  g.beginPath()
  g.arc(cx, gy, 17, 0, Math.PI * 2)
  g.stroke()
  g.beginPath()
  g.ellipse(cx, gy, 17, 5, 0, 0, Math.PI * 2)
  g.stroke()
  for (let k = 0; k < 3; k++) {
    const a = time * 0.0015 + (k * Math.PI) / 3
    g.strokeStyle = hexA(col, 0.6)
    g.beginPath()
    g.ellipse(cx, gy, Math.abs(Math.cos(a)) * 17 + 0.5, 17, 0, 0, Math.PI * 2)
    g.stroke()
  }
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.arc(cx + Math.cos(time * 0.003) * 17, gy + Math.sin(time * 0.003) * 5, 2, 0, Math.PI * 2)
  g.fill()
}

/** Static once baked (the leaf sway only shows on the direct-draw fallback). */
function drawPlanter(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const w = p.w * TILE
  g.fillStyle = 'rgba(217, 70, 239, 0.1)'
  g.fillRect(x + 2, y - 6, w - 4, 24)
  shadow(g, x + w / 2, y + 43, w / 2 - 4, 4)
  g.fillStyle = '#e879f9'
  g.fillRect(x + 3, y - 2, w - 6, 5)
  g.fillStyle = '#a21caf'
  g.fillRect(x + 3, y + 3, w - 6, 2)
  g.fillStyle = '#cbd5e1'
  g.beginPath()
  g.roundRect(x + 2, y + 14, w - 4, 28, 5)
  g.fill()
  g.fillStyle = '#94a3b8'
  g.fillRect(x + 2, y + 34, w - 4, 8)
  g.fillStyle = '#3f2a1d'
  g.fillRect(x + 6, y + 18, w - 12, 12)
  const berries = p.variant === 'berries'
  for (let px = x + 14; px < x + w - 8; px += 16) {
    const sw = Math.sin(time * 0.002 + px * 0.1) * 1.2
    g.fillStyle = '#15803d'
    g.beginPath()
    g.arc(px - 5 + sw, y + 20, 7, 0, Math.PI * 2)
    g.arc(px + 5 + sw, y + 20, 7, 0, Math.PI * 2)
    g.arc(px + sw, y + 13, 8, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#4ade80'
    g.beginPath()
    g.arc(px - 2 + sw, y + 14, 4.5, 0, Math.PI * 2)
    g.fill()
    if (berries) {
      g.fillStyle = '#ef4444'
      g.beginPath()
      g.arc(px + 6 + sw, y + 18, 2.6, 0, Math.PI * 2)
      g.arc(px - 7 + sw, y + 21, 2.2, 0, Math.PI * 2)
      g.fill()
    }
  }
}

function drawReactor(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const col = p.color || '#38bdf8'
  const cx = p.col * TILE + (p.w * TILE) / 2
  const cy = p.row * TILE + (p.h * TILE) / 2
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.003)
  g.fillStyle = hexA(col, 0.08 + pulse * 0.06)
  g.beginPath()
  g.arc(cx, cy, 78, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#1e293b'
  g.beginPath()
  g.arc(cx, cy, 64, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#eab308'
  g.lineWidth = 6
  g.setLineDash([11, 11])
  g.beginPath()
  g.arc(cx, cy, 58, 0, Math.PI * 2)
  g.stroke()
  g.setLineDash([])
  g.fillStyle = '#334155'
  g.beginPath()
  g.arc(cx, cy, 46, 0, Math.PI * 2)
  g.fill()
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    g.fillStyle = '#475569'
    g.beginPath()
    g.arc(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46, 8, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = hexA(col, 0.5 + pulse * 0.5)
    g.beginPath()
    g.arc(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46, 3.4, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#0f172a'
  g.beginPath()
  g.arc(cx, cy, 34, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = col
  g.lineWidth = 4
  g.lineCap = 'round'
  const t = time * 0.002
  for (let k = 0; k < 3; k++) {
    g.beginPath()
    g.arc(cx, cy, 29, t + (k * Math.PI * 2) / 3, t + (k * Math.PI * 2) / 3 + 1.1)
    g.stroke()
  }
  g.lineCap = 'butt'
  g.fillStyle = hexA(col, 0.9)
  g.beginPath()
  g.arc(cx, cy, 17 + pulse * 2.5, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = 'rgba(255, 255, 255, 0.85)'
  g.beginPath()
  g.arc(cx - 2, cy - 2, 8 + pulse * 1.5, 0, Math.PI * 2)
  g.fill()
}

function drawTelescope(g: CanvasRenderingContext2D, p: Prop) {
  const cx = p.col * TILE + TILE / 2
  const by = (p.row + 1) * TILE - 4
  shadow(g, cx, by - 1, 19, 5)
  g.strokeStyle = '#475569'
  g.lineWidth = 3
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(cx, by - 18)
  g.lineTo(cx - 15, by)
  g.moveTo(cx, by - 18)
  g.lineTo(cx + 15, by)
  g.moveTo(cx, by - 18)
  g.lineTo(cx, by - 2)
  g.stroke()
  g.lineCap = 'butt'
  g.save()
  g.translate(cx, by - 20)
  g.rotate(-0.95)
  g.fillStyle = '#e2e8f0'
  g.fillRect(-6, -34, 12, 38)
  g.fillStyle = '#cbd5e1'
  g.fillRect(-6, -34, 4, 38)
  g.fillStyle = '#b45309'
  g.fillRect(-7, -26, 14, 4)
  g.fillRect(-7, -8, 14, 4)
  g.fillStyle = '#0f172a'
  g.fillRect(-7, -38, 14, 6)
  g.fillStyle = '#7dd3fc'
  g.fillRect(-4, -37, 8, 2)
  g.restore()
  g.fillStyle = '#475569'
  g.beginPath()
  g.arc(cx, by - 20, 5, 0, Math.PI * 2)
  g.fill()
}

function drawSolarPanel(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const w = p.w * TILE
  const h = p.h * TILE
  g.fillStyle = '#94a3b8'
  g.fillRect(x - 8, y + h / 2 - 4, 16, 8)
  g.fillRect(x + w - 8, y + h / 2 - 4, 16, 8)
  g.fillStyle = '#cbd5e1'
  g.fillRect(x + 2, y + 2, w - 4, h - 4)
  g.fillStyle = '#0b1e4a'
  g.fillRect(x + 5, y + 5, w - 10, h - 10)
  const nx = Math.max(1, Math.round((w - 10) / 24))
  const ny = Math.max(1, Math.round((h - 10) / 24))
  const cw = (w - 10) / nx
  const ch = (h - 10) / ny
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = x + 5 + i * cw
      const cy = y + 5 + j * ch
      g.fillStyle = (i + j) % 2 === 0 ? '#1d4ed8' : '#1e40af'
      g.fillRect(cx + 1.5, cy + 1.5, cw - 3, ch - 3)
      g.fillStyle = 'rgba(147, 197, 253, 0.4)'
      g.fillRect(cx + 1.5, cy + 1.5, cw - 3, 2)
      g.fillStyle = 'rgba(0, 0, 0, 0.18)'
      g.fillRect(cx + 1.5, cy + ch - 4.5, cw - 3, 3)
    }
  }
  g.fillStyle = '#cbd5e1'
  g.fillRect(x + w / 2 - 2, y + 5, 4, h - 10)
  const sweep = ((time * 0.0003 + p.col * 0.1) % 1.6) - 0.3
  g.save()
  g.beginPath()
  g.rect(x + 5, y + 5, w - 10, h - 10)
  g.clip()
  g.fillStyle = 'rgba(255, 255, 255, 0.16)'
  g.beginPath()
  g.moveTo(x + 5 + sweep * (w - 10), y + 5)
  g.lineTo(x + 5 + sweep * (w - 10) + 18, y + 5)
  g.lineTo(x + 5 + sweep * (w - 10) - 6, y + h - 5)
  g.lineTo(x + 5 + sweep * (w - 10) - 24, y + h - 5)
  g.closePath()
  g.fill()
  g.restore()
}


// =============================================================================================
// NIGHT MARKET PACK (Sky Night Market)
// Everything here throws light (`light`) so the dark tiles around it glow; the string lights hang ABOVE
// people (`overhead`). Static structure is baked once per prop, only steam, flames and sway are live.
// =============================================================================================

const TAU = Math.PI * 2
const WARM = '255, 176, 92'

/** A small bulb: a faint halo, the coloured glass and a white-hot core. */
function bulb(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 1) {
  g.fillStyle = color
  g.globalAlpha = 0.26 * a
  g.beginPath()
  g.arc(x, y, r * 2.7, 0, TAU)
  g.fill()
  g.globalAlpha = a
  g.beginPath()
  g.arc(x, y, r, 0, TAU)
  g.fill()
  g.fillStyle = '#fffbe8'
  g.globalAlpha = 0.85 * a
  g.beginPath()
  g.arc(x, y, r * 0.45, 0, TAU)
  g.fill()
  g.globalAlpha = 1
}

/** `k` puffs of steam or smoke rising from (x, y) and fading as they go. */
function steam(g: CanvasRenderingContext2D, x: number, y: number, t: number, k: number, rise: number, rgb = '255, 255, 255', a = 0.34) {
  for (let i = 0; i < k; i++) {
    const ph = (t * 0.0005 + i / k + noise(Math.floor(x), i, 5)) % 1
    g.fillStyle = `rgba(${rgb}, ${(a * (1 - ph)).toFixed(3)})`
    g.beginPath()
    g.arc(x + Math.sin(ph * 7 + i * 2) * 3.2, y - ph * rise, 2.4 + ph * 5, 0, TAU)
    g.fill()
  }
}

// ---- market stalls -------------------------------------------------------------------------------------

interface StallLook {
  /** the two awning stripe colours */
  a: string
  b: string
  /** the cloth hung under the counter, and its trim */
  skirt: string
  trim: string
  /** colour of the light the goods throw ("r, g, b") */
  glow: string
  /** what is on the counter. x = left edge, by = the counter top, w = width (px) */
  goods: (g: CanvasRenderingContext2D, x: number, by: number, w: number, t: number) => void
}

const STALLS: Record<string, StallLook> = {
  noodles: {
    a: '#d33a2c', b: '#f3e7d0', skirt: '#7d1d1a', trim: '#e9b14f', glow: '255, 200, 120',
    goods(g, x, by, w, t) {
      g.fillStyle = '#8b95a8'
      g.fillRect(x + 10, by - 19, 28, 19)
      g.fillStyle = '#c9d1de'
      g.beginPath()
      g.ellipse(x + 24, by - 19, 14, 5, 0, 0, TAU)
      g.fill()
      g.fillStyle = '#c98c4a'
      g.beginPath()
      g.ellipse(x + 24, by - 19, 11, 3.6, 0, 0, TAU)
      g.fill()
      steam(g, x + 24, by - 21, t, 3, 28)
      for (let bx = x + 52; bx < x + w - 12; bx += 22) {
        g.fillStyle = '#f2ece0'
        g.beginPath()
        g.arc(bx, by - 8, 9, 0, Math.PI)
        g.fill()
        g.fillStyle = '#d28a45'
        g.beginPath()
        g.ellipse(bx, by - 8, 9, 3, 0, 0, TAU)
        g.fill()
        g.fillStyle = '#d6402a'
        g.fillRect(bx - 4, by - 9.6, 2.6, 2.4)
        g.fillStyle = '#4cb86b'
        g.fillRect(bx + 2, by - 9.4, 3.2, 2)
        steam(g, bx, by - 11, t + bx * 20, 2, 14, '255, 255, 255', 0.26)
      }
    },
  },
  skewers: {
    a: '#e8691f', b: '#3b2430', skirt: '#40242c', trim: '#f0a53c', glow: '255, 120, 50',
    goods(g, x, by, w, t) {
      g.fillStyle = '#231a22'
      g.beginPath()
      g.roundRect(x + 8, by - 11, w - 16, 11, 2)
      g.fill()
      for (let i = 0; i < Math.floor((w - 24) / 6); i++) {
        const k = noise(i, Math.floor(x), 3)
        g.globalAlpha = 0.55 + 0.45 * Math.sin(t * 0.008 + i * 1.9 + k * 6)
        g.fillStyle = k > 0.5 ? '#ff7a2a' : '#ffb347'
        g.fillRect(x + 12 + i * 6, by - 8, 4, 4)
      }
      g.globalAlpha = 1
      for (let i = 0; i < Math.floor((w - 26) / 13); i++) {
        const sx = x + 16 + i * 13
        g.strokeStyle = '#d8b883'
        g.lineWidth = 1.6
        g.beginPath()
        g.moveTo(sx - 6, by - 14)
        g.lineTo(sx + 8, by - 20)
        g.stroke()
        g.fillStyle = '#8a4b26'
        for (let m = 0; m < 3; m++) {
          g.beginPath()
          g.arc(sx - 2 + m * 4, by - 15.5 - m * 1.7, 2.7, 0, TAU)
          g.fill()
        }
      }
      steam(g, x + w * 0.5, by - 22, t, 3, 30, '190, 190, 205', 0.22)
    },
  },
  sweets: {
    a: '#ff7eb6', b: '#fff3e0', skirt: '#a8336a', trim: '#ffe08a', glow: '255, 150, 190',
    goods(g, x, by, w) {
      g.fillStyle = '#7a4a2c'
      g.fillRect(x + 8, by - 8, w * 0.5, 8)
      for (let i = 0; i < Math.floor((w * 0.5) / 10); i++) {
        const sx = x + 14 + i * 10
        g.strokeStyle = '#e8d3a0'
        g.lineWidth = 1.5
        g.beginPath()
        g.moveTo(sx, by - 7)
        g.lineTo(sx, by - 28)
        g.stroke()
        for (let f = 0; f < 3; f++) {
          g.fillStyle = f % 2 ? '#e0332f' : '#c2271f'
          g.beginPath()
          g.arc(sx, by - 12 - f * 6, 3.8, 0, TAU)
          g.fill()
          g.fillStyle = 'rgba(255, 255, 255, 0.6)'
          g.fillRect(sx - 1.8, by - 14 - f * 6, 1.6, 1.6)
        }
      }
      for (let k = 0; k < 2; k++) {
        const cx = x + w - 18 - k * 17
        g.fillStyle = '#f5e6c8'
        tri(g, cx - 4, by, cx + 4, by, cx, by - 12)
        g.fillStyle = k ? '#8fd3ff' : '#ff9ec7'
        g.beginPath()
        g.arc(cx, by - 17, 7, 0, TAU)
        g.arc(cx - 5, by - 14, 5, 0, TAU)
        g.arc(cx + 5, by - 14, 5, 0, TAU)
        g.fill()
        g.fillStyle = 'rgba(255, 255, 255, 0.5)'
        g.beginPath()
        g.arc(cx - 2, by - 19, 2.4, 0, TAU)
        g.fill()
      }
    },
  },
  tea: {
    a: '#2aa58c', b: '#f3e7d0', skirt: '#1c5f55', trim: '#e9c46a', glow: '90, 235, 200',
    goods(g, x, by, w, t) {
      g.fillStyle = '#2f9e8f'
      g.beginPath()
      g.arc(x + 22, by - 10, 9.5, 0, TAU)
      g.fill()
      g.fillStyle = '#1f7569'
      g.fillRect(x + 18, by - 21, 8, 3.4)
      g.strokeStyle = '#2f9e8f'
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(x + 30, by - 13)
      g.lineTo(x + 37, by - 19)
      g.stroke()
      g.beginPath()
      g.arc(x + 11, by - 11, 5, Math.PI * 0.55, Math.PI * 1.5)
      g.stroke()
      steam(g, x + 22, by - 23, t, 3, 26)
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#f6f1e6'
        g.beginPath()
        g.arc(x + 48 + i * 11, by - 4, 5, 0, Math.PI)
        g.fill()
      }
      for (let k = 0; k < 3; k++) {
        const sy = by - 7 - k * 7
        g.fillStyle = '#c99a58'
        g.fillRect(x + w - 32, sy, 24, 7)
        g.fillStyle = '#e2bd7c'
        g.beginPath()
        g.ellipse(x + w - 20, sy, 12, 3, 0, 0, TAU)
        g.fill()
      }
      steam(g, x + w - 20, by - 28, t + 400, 2, 20, '255, 255, 255', 0.3)
    },
  },
  toys: {
    a: '#3a7bd5', b: '#ffd23f', skirt: '#223f7c', trim: '#ffd23f', glow: '170, 210, 255',
    goods(g, x, by, w, t) {
      for (let i = 0; i < 3; i++) {
        const mx = x + 16 + i * ((w - 32) / 2)
        g.fillStyle = '#f6f0e4'
        g.beginPath()
        g.arc(mx, by - 26, 8, 0, TAU)
        g.fill()
        g.fillStyle = i === 1 ? '#3a7bd5' : '#d6402a'
        tri(g, mx - 7, by - 31, mx - 2, by - 31, mx - 6, by - 38)
        tri(g, mx + 7, by - 31, mx + 2, by - 31, mx + 6, by - 38)
        g.fillRect(mx - 5, by - 27, 3, 2.4)
        g.fillRect(mx + 2, by - 27, 3, 2.4)
        g.fillStyle = '#1b1226'
        g.fillRect(mx - 1, by - 23, 2, 3)
      }
      const colors = ['#ff5a7a', '#42d6a4', '#ffd23f', '#6aa8ff'] as const
      for (let i = 0; i < Math.min(3, Math.floor((w - 20) / 22)); i++) {
        const px = x + 14 + i * 22 + 6
        g.strokeStyle = '#d8c7a0'
        g.lineWidth = 1.4
        g.beginPath()
        g.moveTo(px, by)
        g.lineTo(px, by - 12)
        g.stroke()
        const a0 = t * 0.006 + i * 1.3
        for (let b = 0; b < 4; b++) {
          const a = a0 + (b * TAU) / 4
          g.fillStyle = colors[(b + i) % 4]!
          tri(g, px, by - 12, px + Math.cos(a) * 8, by - 12 + Math.sin(a) * 8, px + Math.cos(a + 0.9) * 6, by - 12 + Math.sin(a + 0.9) * 6)
        }
      }
    },
  },
  fruit: {
    a: '#3fa34d', b: '#fff0b0', skirt: '#2a6a33', trim: '#ffd86b', glow: '255, 210, 110',
    goods(g, x, by, w) {
      const fruit = ['#ff9a2a', '#e03a2c', '#d6336c', '#9bd94a'] as const
      for (let i = 0; i < Math.floor((w - 12) / 24); i++) {
        const cx = x + 8 + i * 24
        g.fillStyle = '#8a5a2e'
        g.fillRect(cx, by - 12, 22, 12)
        g.fillStyle = '#5a3a1c'
        g.fillRect(cx, by - 7, 22, 1.4)
        for (let f = 0; f < 4; f++) {
          g.fillStyle = fruit[(i + f) % 4]!
          g.beginPath()
          g.arc(cx + 4 + f * 5, by - 14 - (f % 2) * 2.4, 3.6, 0, TAU)
          g.fill()
          g.fillStyle = 'rgba(255, 255, 255, 0.4)'
          g.fillRect(cx + 3 + f * 5, by - 16 - (f % 2) * 2.4, 1.4, 1.4)
        }
      }
    },
  },
  fortune: {
    a: '#7a4fc4', b: '#e9c46a', skirt: '#40286e', trim: '#e9c46a', glow: '120, 230, 255',
    goods(g, x, by, w, t) {
      const cx = x + w / 2
      const pulse = 1 + Math.sin(t * 0.004) * 0.08
      g.fillStyle = '#4a3a6a'
      g.fillRect(cx - 8, by - 5, 16, 5)
      const grad = g.createRadialGradient(cx - 2, by - 14, 1, cx, by - 12, 10 * pulse)
      grad.addColorStop(0, '#e6fdff')
      grad.addColorStop(0.5, '#69d4f2')
      grad.addColorStop(1, '#2a7fb8')
      g.fillStyle = grad
      g.beginPath()
      g.arc(cx, by - 12, 9 * pulse, 0, TAU)
      g.fill()
      for (let i = 0; i < 3; i++) {
        g.save()
        g.translate(x + 18 + i * 3, by - 5)
        g.rotate(-0.5 + i * 0.4)
        g.fillStyle = '#f6efe0'
        g.fillRect(-4, -11, 8, 12)
        g.fillStyle = '#c9a24a'
        g.fillRect(-2.5, -9, 5, 1.6)
        g.restore()
      }
      g.strokeStyle = '#8a5a2e'
      g.lineWidth = 1.4
      g.beginPath()
      g.moveTo(x + w - 14, by)
      g.lineTo(x + w - 14, by - 18)
      g.stroke()
      g.fillStyle = '#ff6a3a'
      g.fillRect(x + w - 15, by - 19, 2, 2)
      steam(g, x + w - 14, by - 20, t, 3, 24, '210, 200, 230', 0.28)
    },
  },
  goldfish: {
    a: '#18a5b8', b: '#f4fbff', skirt: '#0f6674', trim: '#bff3ff', glow: '100, 210, 255',
    goods(g, x, by, w, t) {
      const bw = w / 2 - 12
      for (let i = 0; i < 2; i++) {
        const bx = x + 8 + i * (w / 2 - 4)
        g.fillStyle = '#e8f4ff'
        g.beginPath()
        g.roundRect(bx, by - 14, bw, 14, 5)
        g.fill()
        g.fillStyle = '#3aa9e6'
        g.beginPath()
        g.roundRect(bx + 2, by - 12.5, bw - 4, 10, 4)
        g.fill()
        for (let k = 0; k < 3; k++) {
          const sw = Math.sin(t * 0.0013 * (k + 1) + i * 3 + k) * 0.5 + 0.5
          const fx = bx + 6 + sw * Math.max(2, bw - 18)
          const fy = by - 8 + Math.sin(t * 0.003 + k * 2 + i) * 1.8
          const dir = Math.cos(t * 0.0013 * (k + 1) + i * 3 + k) > 0 ? 1 : -1
          g.fillStyle = k === 1 ? '#ffd23f' : '#ff7a2a'
          g.beginPath()
          g.ellipse(fx, fy, 3.6, 2.2, 0, 0, TAU)
          g.fill()
          tri(g, fx - dir * 3, fy, fx - dir * 7, fy - 2.6, fx - dir * 7, fy + 2.6)
        }
      }
      g.strokeStyle = '#d8c7a0'
      g.lineWidth = 1.4
      g.beginPath()
      g.moveTo(x + w - 10, by)
      g.lineTo(x + w - 10, by - 20)
      g.stroke()
      g.strokeStyle = '#f6efe0'
      g.beginPath()
      g.arc(x + w - 10, by - 24, 4.4, 0, TAU)
      g.stroke()
    },
  },
}

function stallLook(p: Prop): StallLook {
  return STALLS[p.variant ?? 'noodles'] ?? STALLS.noodles!
}

/** Everything about a stall that never moves: shadow, posts, counter, striped awning with scalloped edge. */
function paintStall(g: CanvasRenderingContext2D, p: Prop) {
  const look = stallLook(p)
  const x = p.col * TILE
  const y = p.row * TILE
  const W = p.w * TILE
  shadow(g, x + W / 2, y + 2 * TILE - 7, W / 2 + 3, 6, 0.4)
  g.fillStyle = '#150e22'
  g.fillRect(x + 3, y + 22, W - 6, 46)
  g.fillStyle = '#2a1d3c'
  g.fillRect(x + 3, y + 45, W - 6, 3)
  g.fillStyle = '#5a3a2a'
  g.fillRect(x, y + 6, 6, 88)
  g.fillRect(x + W - 6, y + 6, 6, 88)
  g.fillStyle = 'rgba(255, 200, 150, 0.2)'
  g.fillRect(x + 1, y + 6, 1.5, 88)
  g.fillRect(x + W - 5, y + 6, 1.5, 88)
  g.fillStyle = '#7b4a2b'
  g.beginPath()
  g.roundRect(x + 2, y + 64, W - 4, 11, 3)
  g.fill()
  g.fillStyle = 'rgba(255, 224, 176, 0.24)'
  g.fillRect(x + 4, y + 65, W - 8, 2)
  g.fillStyle = look.skirt
  g.fillRect(x + 4, y + 75, W - 8, 18)
  g.fillStyle = look.trim
  g.fillRect(x + 4, y + 75, W - 8, 2.4)
  g.fillRect(x + 4, y + 90.6, W - 8, 2.4)
  g.fillStyle = 'rgba(255, 255, 255, 0.14)'
  for (let dx = 11; dx < W - 11; dx += 14) {
    g.beginPath()
    g.moveTo(x + dx, y + 84)
    g.lineTo(x + dx + 4, y + 80)
    g.lineTo(x + dx + 8, y + 84)
    g.lineTo(x + dx + 4, y + 88)
    g.closePath()
    g.fill()
  }
  const n = Math.max(2, Math.round(W / 15))
  const sw = W / n
  g.save()
  g.beginPath()
  g.moveTo(x + 5, y + 5)
  g.lineTo(x + W - 5, y + 5)
  g.lineTo(x + W, y + 31)
  g.lineTo(x, y + 31)
  g.closePath()
  g.clip()
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? look.b : look.a
    g.fillRect(x + i * sw, y + 5, sw + 0.5, 27)
  }
  const shade = g.createLinearGradient(0, y + 5, 0, y + 31)
  shade.addColorStop(0, 'rgba(10, 4, 24, 0.55)')
  shade.addColorStop(0.55, 'rgba(10, 4, 24, 0.12)')
  shade.addColorStop(1, 'rgba(255, 225, 170, 0.18)')
  g.fillStyle = shade
  g.fillRect(x, y + 5, W, 27)
  g.restore()
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? look.b : look.a
    g.beginPath()
    g.ellipse(x + (i + 0.5) * sw, y + 31, sw / 2, 7, 0, 0, Math.PI)
    g.fill()
    g.fillStyle = 'rgba(255, 225, 170, 0.14)'
    g.fill()
  }
  g.fillStyle = 'rgba(255, 255, 255, 0.22)'
  g.fillRect(x + 5, y + 5, W - 10, 1.6)
}

const paintStallBaked = bakedProp(paintStall, 10)

function drawStall(g: CanvasRenderingContext2D, p: Prop, time: number) {
  paintStallBaked(g, p, time)
  const x = p.col * TILE
  const y = p.row * TILE
  const W = p.w * TILE
  stallLook(p).goods(g, x, y + 64, W, time)
  const n = Math.max(2, Math.round(W / 15))
  for (let i = 0; i < n; i++) bulb(g, x + ((i + 0.5) * W) / n, y + 41, 2.1, '#ffe6a6', 0.78 + 0.22 * Math.sin(time * 0.004 + i * 1.7 + p.col))
}

function stallLight(p: Prop, t: number, emit: EmitLight) {
  const x = p.col * TILE
  const y = p.row * TILE
  const W = p.w * TILE
  emit({ x: x + W / 2, y: y + TILE * 1.9, r: 80 + W * 0.5, rgb: WARM, a: 0.3 })
  emit({ x: x + W / 2, y: y + 44, r: 44 + W * 0.28, rgb: stallLook(p).glow, a: 0.2 + 0.06 * Math.sin(t * 0.006 + p.col) })
}

// ---- lanterns on poles ---------------------------------------------------------------------------------

const LANTERN_COLORS: Record<string, { body: string; edge: string; rgb: string }> = {
  red: { body: '#ff6a3c', edge: '#8e1f15', rgb: '255, 96, 56' },
  amber: { body: '#ffc44d', edge: '#9a5a12', rgb: '255, 186, 80' },
  jade: { body: '#5cf0c4', edge: '#126a55', rgb: '70, 235, 190' },
}

function lanternColors(p: Prop) {
  return LANTERN_COLORS[p.variant ?? 'red'] ?? LANTERN_COLORS.red!
}

/** One paper lantern hanging from (0, 0): ribbed body, dark caps, a tassel. Caller translates/rotates. */
function paperLantern(g: CanvasRenderingContext2D, c: { body: string; edge: string }, s = 1) {
  g.strokeStyle = '#2a1a1a'
  g.lineWidth = 1.4
  g.beginPath()
  g.moveTo(0, 0)
  g.lineTo(0, 5 * s)
  g.stroke()
  const grad = g.createRadialGradient(0, 15 * s, 1, 0, 15 * s, 14 * s)
  grad.addColorStop(0, '#fff3c4')
  grad.addColorStop(0.35, c.body)
  grad.addColorStop(1, c.edge)
  g.fillStyle = grad
  g.beginPath()
  g.ellipse(0, 15 * s, 10.5 * s, 12.5 * s, 0, 0, TAU)
  g.fill()
  g.strokeStyle = 'rgba(70, 10, 6, 0.4)'
  g.lineWidth = 1
  for (let i = -1; i <= 1; i++) {
    g.beginPath()
    g.ellipse(0, 15 * s, 10.5 * s, Math.abs(i) * 4 * s + 0.01, 0, 0, TAU)
    if (i !== 0) g.stroke()
  }
  g.fillStyle = '#2b1713'
  g.fillRect(-5 * s, 3 * s, 10 * s, 3 * s)
  g.fillRect(-5 * s, 25.5 * s, 10 * s, 3 * s)
  g.strokeStyle = '#f0b64a'
  g.lineWidth = 1.2
  g.beginPath()
  g.moveTo(0, 28.5 * s)
  g.lineTo(0, 34 * s)
  g.stroke()
  g.fillStyle = '#f0b64a'
  g.fillRect(-1.6 * s, 33 * s, 3.2 * s, 5 * s)
}

function drawLanternPost(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2
  const c = lanternColors(p)
  shadow(g, cx, y + 44, 15, 5, 0.4)
  g.fillStyle = '#3b3566'
  g.beginPath()
  g.roundRect(cx - 9, y + 36, 18, 9, 3)
  g.fill()
  g.fillStyle = '#2b1c1c'
  g.fillRect(cx - 2.5, y - 40, 5, 78)
  g.fillRect(cx - 21, y - 37, 42, 4)
  g.fillStyle = '#e6b45a'
  g.beginPath()
  g.arc(cx, y - 42, 3.4, 0, TAU)
  g.fill()
  for (const side of [-1, 1] as const) {
    g.save()
    g.translate(cx + side * 17, y - 33)
    g.rotate(Math.sin(time * 0.0016 + p.col * 1.7 + side) * 0.07)
    paperLantern(g, c, 0.95)
    g.restore()
  }
}

function lanternPostLight(p: Prop, t: number, emit: EmitLight) {
  const cx = p.col * TILE + TILE / 2
  const y = p.row * TILE
  const c = lanternColors(p)
  const f = 0.34 + 0.05 * Math.sin(t * 0.007 + p.col * 3 + p.row)
  emit({ x: cx - 17, y: y - 16, r: 96, rgb: c.rgb, a: f })
  emit({ x: cx + 17, y: y - 16, r: 96, rgb: c.rgb, a: f })
  emit({ x: cx, y: y + 40, r: 86, rgb: WARM, a: 0.22 })
}

// ---- string lights (overhead) --------------------------------------------------------------------------

const STRING_BULBS = ['#ffe3a0', '#ff8a5c', '#ffd36b', '#7cf0cf', '#ffe3a0', '#ff6f91'] as const
const STRING_SPAN = 96

/** Geometry shared by the wire and its light: where each hung segment starts, ends and sags. */
function stringSegments(p: Prop) {
  const vertical = p.h > p.w
  const len = (vertical ? p.h : p.w) * TILE
  const n = Math.max(1, Math.round(len / STRING_SPAN))
  const sl = len / n
  const at = (d: number) => (vertical ? { x: p.col * TILE + TILE / 2, y: p.row * TILE + d } : { x: p.col * TILE + d, y: p.row * TILE + TILE / 2 })
  return Array.from({ length: n }, (_, i) => {
    const a = at(i * sl)
    const b = at((i + 1) * sl)
    const sag = 9 + noise(p.col + i, p.row, 5) * 6
    // a quadratic curve whose control point is 2*sag away drops exactly `sag` at its middle
    const c = vertical ? { x: (a.x + b.x) / 2 + sag * 2, y: (a.y + b.y) / 2 } : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sag * 2 }
    return { a, b, c, i }
  })
}

function drawStringLights(g: CanvasRenderingContext2D, p: Prop, time: number) {
  g.lineCap = 'round'
  for (const s of stringSegments(p)) {
    g.strokeStyle = 'rgba(16, 10, 26, 0.9)'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(s.a.x, s.a.y)
    g.quadraticCurveTo(s.c.x, s.c.y, s.b.x, s.b.y)
    g.stroke()
    g.fillStyle = '#2b1c1c'
    g.beginPath()
    g.arc(s.a.x, s.a.y, 2.6, 0, TAU)
    g.fill()
    for (let k = 1; k <= 3; k++) {
      const u = k / 4
      const bx = (1 - u) * (1 - u) * s.a.x + 2 * (1 - u) * u * s.c.x + u * u * s.b.x
      const by = (1 - u) * (1 - u) * s.a.y + 2 * (1 - u) * u * s.c.y + u * u * s.b.y
      const idx = s.i * 3 + k + p.col
      bulb(g, bx, by + 2.5, 2.2, STRING_BULBS[idx % STRING_BULBS.length]!, 0.72 + 0.28 * Math.sin(time * 0.004 + idx * 1.7))
    }
  }
}

function stringLightsLight(p: Prop, t: number, emit: EmitLight) {
  for (const s of stringSegments(p)) {
    const mx = 0.25 * s.a.x + 0.5 * s.c.x + 0.25 * s.b.x
    const my = 0.25 * s.a.y + 0.5 * s.c.y + 0.25 * s.b.y
    emit({ x: mx, y: my + 8, r: 64, rgb: WARM, a: 0.2 + 0.03 * Math.sin(t * 0.004 + s.i) })
  }
}

// ---- neon signs ----------------------------------------------------------------------------------------

const NEON: Record<string, { color: string; rgb: string; path: (g: CanvasRenderingContext2D, cx: number, cy: number) => void }> = {
  bowl: {
    color: '#ff5a7a', rgb: '255, 90, 122',
    path(g, cx, cy) {
      g.beginPath()
      g.arc(cx, cy - 2, 13, 0, Math.PI)
      g.closePath()
      for (const dx of [-6, 0, 6]) {
        g.moveTo(cx + dx, cy - 8)
        g.quadraticCurveTo(cx + dx - 3, cy - 12, cx + dx, cy - 15)
      }
    },
  },
  fish: {
    color: '#ffb347', rgb: '255, 179, 71',
    path(g, cx, cy) {
      g.beginPath()
      g.ellipse(cx - 3, cy, 12, 7, 0, 0, TAU)
      g.moveTo(cx + 8, cy)
      g.lineTo(cx + 17, cy - 7)
      g.lineTo(cx + 17, cy + 7)
      g.closePath()
      g.moveTo(cx - 10, cy - 1.5)
      g.arc(cx - 10, cy - 1.5, 0.6, 0, TAU)
    },
  },
  cup: {
    color: '#2de2b0', rgb: '45, 226, 176',
    path(g, cx, cy) {
      g.beginPath()
      g.roundRect(cx - 10, cy - 4, 18, 14, 4)
      g.moveTo(cx + 8, cy)
      g.arc(cx + 11, cy + 3, 5, -Math.PI / 2, Math.PI / 2)
      for (const dx of [-5, 1]) {
        g.moveTo(cx + dx, cy - 8)
        g.quadraticCurveTo(cx + dx - 3, cy - 12, cx + dx, cy - 15)
      }
    },
  },
  moon: {
    color: '#ffe27a', rgb: '255, 226, 122',
    path(g, cx, cy) {
      g.beginPath()
      g.arc(cx, cy, 12, Math.PI * 0.62, Math.PI * 1.38, true)
      g.arc(cx + 5, cy, 9.4, Math.PI * 1.3, Math.PI * 0.7, false)
    },
  },
  star: {
    color: '#8ab4ff', rgb: '138, 180, 255',
    path(g, cx, cy) {
      g.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const rr = i % 2 ? 6 : 14
        if (i === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
        else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
      }
      g.closePath()
    },
  },
}

/** Neon flickers now and then: a brief dip, same moment for every frame inside the same 180 ms. */
function neonLevel(p: Prop, t: number): number {
  return noise(Math.floor(t / 180), p.col * 3 + p.row, 9) > 0.93 ? 0.4 : 1
}

function drawNeonSign(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const neon = NEON[p.variant ?? 'bowl'] ?? NEON.bowl!
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = '#120d22'
  g.beginPath()
  g.roundRect(x + 4, y + 5, p.w * TILE - 8, TILE - 12, 7)
  g.fill()
  g.strokeStyle = '#3f2e5e'
  g.lineWidth = 2
  g.stroke()
  const f = neonLevel(p, time)
  const cx = x + (p.w * TILE) / 2
  const cy = y + TILE / 2 - 1
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.strokeStyle = neon.color
  for (const [w, a] of [[8, 0.14], [4.5, 0.3], [2, 1]] as const) {
    g.globalAlpha = a * f
    g.lineWidth = w
    neon.path(g, cx, cy)
    g.stroke()
  }
  g.globalAlpha = 0.75 * f
  g.strokeStyle = '#ffffff'
  g.lineWidth = 0.7
  neon.path(g, cx, cy)
  g.stroke()
  g.globalAlpha = 1
}

function neonLight(p: Prop, t: number, emit: EmitLight) {
  const neon = NEON[p.variant ?? 'bowl'] ?? NEON.bowl!
  emit({ x: p.col * TILE + (p.w * TILE) / 2, y: p.row * TILE + TILE / 2 + 10, r: 86, rgb: neon.rgb, a: 0.26 * neonLevel(p, t) })
}

// ---- the wishing tree ----------------------------------------------------------------------------------

function drawWishingTree(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + (p.w * TILE) / 2
  const baseY = y + p.h * TILE - 12
  shadow(g, cx, baseY + 4, 70, 18, 0.45)
  g.fillStyle = '#3b3566'
  g.beginPath()
  g.ellipse(cx, baseY, 62, 19, 0, 0, TAU)
  g.fill()
  g.fillStyle = '#524a8c'
  g.beginPath()
  g.ellipse(cx, baseY - 4, 62, 17, 0, Math.PI, TAU)
  g.fill()
  g.fillStyle = '#1b1226'
  g.beginPath()
  g.ellipse(cx, baseY - 3, 52, 13, 0, 0, TAU)
  g.fill()
  // trunk and two limbs
  g.strokeStyle = '#3d2530'
  g.lineCap = 'round'
  g.lineWidth = 17
  g.beginPath()
  g.moveTo(cx, baseY - 2)
  g.quadraticCurveTo(cx - 4, baseY - 44, cx, baseY - 84)
  g.stroke()
  g.lineWidth = 8
  g.beginPath()
  g.moveTo(cx, baseY - 60)
  g.quadraticCurveTo(cx - 28, baseY - 78, cx - 50, baseY - 112)
  g.moveTo(cx, baseY - 66)
  g.quadraticCurveTo(cx + 30, baseY - 82, cx + 52, baseY - 114)
  g.stroke()
  g.strokeStyle = 'rgba(255, 200, 160, 0.16)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(cx - 5, baseY - 4)
  g.quadraticCurveTo(cx - 9, baseY - 44, cx - 5, baseY - 80)
  g.stroke()
  // blossom canopy
  const bloom = ['#7d2f73', '#a63d87', '#cf5fa9', '#e58ac4'] as const
  for (let i = 0; i < 46; i++) {
    const a = noise(p.col, i, 1) * TAU
    const d = Math.sqrt(noise(p.col, i, 2))
    const bx = cx + Math.cos(a) * d * 86 + Math.sin(time * 0.0012 + i) * 1.6
    const by = baseY - 122 + Math.sin(a) * d * 44
    g.fillStyle = bloom[Math.floor(noise(p.col, i, 3) * 4)]!
    g.beginPath()
    g.arc(bx, by, 17 + noise(p.col, i, 4) * 13, 0, TAU)
    g.fill()
  }
  g.fillStyle = 'rgba(255, 220, 240, 0.16)'
  for (let i = 0; i < 9; i++) {
    g.beginPath()
    g.arc(cx - 50 + noise(p.col, i, 8) * 70, baseY - 140 + noise(p.col, i, 9) * 20, 9 + noise(p.col, i, 10) * 6, 0, TAU)
    g.fill()
  }
  // wishes: paper lanterns and tags on strings, swaying
  for (let i = 0; i < 24; i++) {
    const a = noise(p.col, i, 21) * 2 - 1
    const ax = cx + a * 74
    const ay = baseY - 112 + Math.abs(a) * 26 + noise(p.col, i, 22) * 8
    const len = 14 + noise(p.col, i, 23) * 28
    const sway = Math.sin(time * 0.0018 + i * 1.9) * 3
    g.strokeStyle = 'rgba(255, 230, 200, 0.55)'
    g.lineWidth = 0.9
    g.beginPath()
    g.moveTo(ax, ay)
    g.lineTo(ax + sway, ay + len)
    g.stroke()
    if (i % 3 === 0) {
      g.fillStyle = '#f6ecd6'
      g.fillRect(ax + sway - 2.6, ay + len, 5.2, 10)
      g.fillStyle = '#c7372a'
      g.fillRect(ax + sway - 2.6, ay + len, 5.2, 2)
    } else {
      bulb(g, ax + sway, ay + len + 3, 2.6, i % 3 === 1 ? '#ffc44d' : '#ff7a4a', 0.95)
    }
  }
  // falling petals
  g.fillStyle = '#ffc3e3'
  for (let i = 0; i < 9; i++) {
    const ph = (time * 0.00018 + i / 9 + noise(p.col, i, 31)) % 1
    g.globalAlpha = 0.85 * (1 - ph)
    g.beginPath()
    g.ellipse(cx + (noise(p.col, i, 32) * 2 - 1) * 84 + Math.sin(ph * 9 + i) * 11, baseY - 104 + ph * 118, 3, 1.8, ph * 6, 0, TAU)
    g.fill()
  }
  g.globalAlpha = 1
}

function wishingTreeLight(p: Prop, t: number, emit: EmitLight) {
  const cx = p.col * TILE + (p.w * TILE) / 2
  const baseY = p.row * TILE + p.h * TILE - 12
  const s = 0.04 * Math.sin(t * 0.002)
  emit({ x: cx, y: baseY - 100, r: 190, rgb: '255, 130, 190', a: 0.24 + s })
  emit({ x: cx, y: baseY - 60, r: 140, rgb: WARM, a: 0.24 - s })
  emit({ x: cx, y: baseY, r: 120, rgb: WARM, a: 0.2 })
}

// ---- tables, crates, floating lanterns, pillars, banners ------------------------------------------------

function paintNightTable(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const W = p.w * TILE
  shadow(g, x + W / 2, y + TILE - 6, W / 2, 5, 0.4)
  g.fillStyle = '#a5683c'
  g.beginPath()
  g.roundRect(x + 3, y + 9, W - 6, TILE - 19, 6)
  g.fill()
  g.fillStyle = '#3a2119'
  g.beginPath()
  g.roundRect(x + 5.5, y + 11.5, W - 11, TILE - 24, 4)
  g.fill()
  g.fillStyle = '#9d2f28'
  g.fillRect(x + 8, y + 18, W - 16, 8)
  g.fillStyle = '#e6b45a'
  g.fillRect(x + 8, y + 18, W - 16, 1.4)
  g.fillRect(x + 8, y + 24.6, W - 16, 1.4)
  for (let i = 0; i < p.w; i++) {
    const bx = x + i * TILE + (p.w === 1 ? TILE / 2 : i % 2 ? 36 : 12)
    g.fillStyle = '#f2ece0'
    g.beginPath()
    g.arc(bx, y + 22, 6.4, 0, TAU)
    g.fill()
    g.fillStyle = '#c98c4a'
    g.beginPath()
    g.arc(bx, y + 22, 4.6, 0, TAU)
    g.fill()
    g.strokeStyle = '#d8c7a0'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(bx + 5, y + 14)
    g.lineTo(bx + 9, y + 26)
    g.moveTo(bx + 7.5, y + 14)
    g.lineTo(bx + 11.5, y + 26)
    g.stroke()
  }
}

const paintNightTableBaked = bakedProp(paintNightTable, 4)

function drawNightTable(g: CanvasRenderingContext2D, p: Prop, time: number) {
  paintNightTableBaked(g, p, time)
  const x = p.col * TILE
  const y = p.row * TILE
  const W = p.w * TILE
  const f = 0.85 + 0.15 * Math.sin(time * 0.009 + p.col * 2.3)
  bulb(g, x + W / 2, y + 20, 2.8, '#ffb347', f)
  steam(g, x + 12, y + 18, time + p.col * 90, 1, 12, '255, 255, 255', 0.2)
}

function nightTableLight(p: Prop, t: number, emit: EmitLight) {
  emit({ x: p.col * TILE + (p.w * TILE) / 2, y: p.row * TILE + 22, r: 54 + p.w * 10, rgb: WARM, a: 0.2 + 0.03 * Math.sin(t * 0.009 + p.col) })
}

function drawCrates(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2
  shadow(g, cx, y + 44, 21, 6, 0.4)
  const v = p.variant ?? 'crates'
  if (v === 'barrels') {
    for (const [bx, s] of [[cx - 8, 1], [cx + 11, 0.8]] as const) {
      g.fillStyle = '#5b3a24'
      g.beginPath()
      g.roundRect(bx - 12 * s, y + 46 - 36 * s, 24 * s, 36 * s, 8)
      g.fill()
      g.fillStyle = '#2b2b35'
      g.fillRect(bx - 12 * s, y + 46 - 28 * s, 24 * s, 2.4)
      g.fillRect(bx - 12 * s, y + 46 - 11 * s, 24 * s, 2.4)
      g.fillStyle = '#7a4f32'
      g.beginPath()
      g.ellipse(bx, y + 46 - 36 * s + 2, 11 * s, 4, 0, 0, TAU)
      g.fill()
      g.fillStyle = 'rgba(255, 210, 160, 0.16)'
      g.fillRect(bx - 8 * s, y + 46 - 32 * s, 2, 26 * s)
    }
  } else if (v === 'baskets') {
    for (const [bx, by, r, col] of [[cx - 9, y + 32, 13, '#b88a4a'], [cx + 12, y + 38, 9.5, '#a97a3c']] as const) {
      g.fillStyle = col
      g.beginPath()
      g.arc(bx, by, r, 0, TAU)
      g.fill()
      g.strokeStyle = 'rgba(70, 40, 10, 0.45)'
      g.lineWidth = 1
      for (let i = -2; i <= 2; i++) {
        g.beginPath()
        g.moveTo(bx + i * 4.5, by - r)
        g.lineTo(bx + i * 4.5, by + r)
        g.stroke()
      }
      g.fillStyle = '#d6402a'
      for (let i = 0; i < 5; i++) {
        g.beginPath()
        g.arc(bx - r * 0.6 + i * (r * 0.3), by - r * 0.4 + (i % 2) * 3, 2.6, 0, TAU)
        g.fill()
      }
    }
  } else {
    g.fillStyle = '#7d4f2a'
    g.fillRect(cx - 18, y + 24, 36, 22)
    g.fillStyle = '#5a3a1c'
    g.fillRect(cx - 18, y + 33, 36, 1.6)
    g.fillRect(cx - 18, y + 24, 3.4, 22)
    g.fillRect(cx + 14.6, y + 24, 3.4, 22)
    g.fillStyle = '#946036'
    g.fillRect(cx - 12, y + 6, 26, 18)
    g.fillStyle = '#5a3a1c'
    g.fillRect(cx - 12, y + 14, 26, 1.6)
    g.fillStyle = '#ff9a2a'
    for (let i = 0; i < 4; i++) {
      g.beginPath()
      g.arc(cx - 8 + i * 7, y + 5 - (i % 2) * 2, 4, 0, TAU)
      g.fill()
    }
  }
}

const POND_LANTERNS = ['255, 190, 90', '255, 100, 70', '255, 140, 200', '90, 235, 200'] as const
const pondColor = (p: Prop) => POND_LANTERNS[Math.floor(noise(p.col, p.row, 61) * 4)]!

/** Where a floating lantern is right now (px). Ponds bob in place; sky lanterns rise, fading in and out. */
function floaterState(p: Prop, t: number) {
  const x = p.col * TILE + TILE / 2
  const y = p.row * TILE + TILE / 2
  if (p.variant === 'sky') {
    const ph = (t * 0.00007 + noise(p.col, p.row, 62)) % 1
    return { x: x + Math.sin(ph * 5 + p.col) * 9, y: y + 10 - ph * TILE * 5, fade: Math.sin(ph * Math.PI) ** 0.6 }
  }
  return { x: x + Math.sin(t * 0.0009 + p.col * 2) * 3.4, y: y + Math.sin(t * 0.0012 + p.row * 3) * 2.4, fade: 1 }
}

function drawFloatingLantern(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const s = floaterState(p, time)
  if (p.variant === 'sky') {
    g.globalAlpha = s.fade
    g.fillStyle = '#ffb347'
    g.globalAlpha = 0.2 * s.fade
    g.beginPath()
    g.arc(s.x, s.y, 22, 0, TAU)
    g.fill()
    g.globalAlpha = s.fade
    const grad = g.createLinearGradient(s.x, s.y - 11, s.x, s.y + 11)
    grad.addColorStop(0, '#ffe9a8')
    grad.addColorStop(1, '#ff9a3c')
    g.fillStyle = grad
    g.beginPath()
    g.moveTo(s.x - 8, s.y - 10)
    g.lineTo(s.x + 8, s.y - 10)
    g.lineTo(s.x + 6, s.y + 10)
    g.lineTo(s.x - 6, s.y + 10)
    g.closePath()
    g.fill()
    g.fillStyle = '#7a3a14'
    g.fillRect(s.x - 8, s.y - 11, 16, 2.4)
    g.fillRect(s.x - 6, s.y + 9, 12, 2.4)
    g.fillStyle = '#fff6d0'
    g.beginPath()
    g.arc(s.x, s.y + 8, 2.6, 0, TAU)
    g.fill()
    g.globalAlpha = 1
    return
  }
  const rgb = pondColor(p)
  const ring = (time * 0.0006 + noise(p.col, p.row, 63)) % 1
  g.strokeStyle = `rgba(${rgb}, ${(0.3 * (1 - ring)).toFixed(3)})`
  g.lineWidth = 1.2
  g.beginPath()
  g.ellipse(s.x, s.y + 3, 8 + ring * 14, 3 + ring * 5, 0, 0, TAU)
  g.stroke()
  g.fillStyle = '#3a1f1a'
  g.beginPath()
  g.ellipse(s.x, s.y + 3, 8, 3.4, 0, 0, TAU)
  g.fill()
  g.fillStyle = `rgb(${rgb})`
  g.beginPath()
  g.ellipse(s.x, s.y, 6.4, 5.6, 0, Math.PI, TAU)
  g.fill()
  g.fillStyle = '#fffbe8'
  g.globalAlpha = 0.85
  g.beginPath()
  g.arc(s.x, s.y - 0.5, 2.4, 0, TAU)
  g.fill()
  g.globalAlpha = 1
}

function floatingLanternLight(p: Prop, t: number, emit: EmitLight) {
  const s = floaterState(p, t)
  if (p.variant === 'sky') emit({ x: s.x, y: s.y, r: 96, rgb: '255, 176, 80', a: 0.4 * s.fade })
  else emit({ x: s.x, y: s.y, r: 52, rgb: pondColor(p), a: 0.34 + 0.05 * Math.sin(t * 0.004 + p.col) })
}

function drawPillar(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2
  shadow(g, cx, y + 44, 17, 6, 0.4)
  g.fillStyle = '#3a3252'
  g.beginPath()
  g.roundRect(cx - 14, y + 33, 28, 12, 3)
  g.fill()
  g.fillStyle = '#524a78'
  g.fillRect(cx - 14, y + 33, 28, 2.4)
  const shaft = g.createLinearGradient(cx - 9, 0, cx + 9, 0)
  shaft.addColorStop(0, '#5e1a15')
  shaft.addColorStop(0.45, '#d23a2c')
  shaft.addColorStop(1, '#6b1d17')
  g.fillStyle = shaft
  g.fillRect(cx - 9, y - 40, 18, 76)
  g.fillStyle = '#d6a84a'
  g.fillRect(cx - 10, y - 36, 20, 4)
  g.fillRect(cx - 10, y + 28, 20, 4)
  g.fillStyle = '#3a1c1a'
  g.beginPath()
  g.roundRect(cx - 15, y - 48, 30, 10, 3)
  g.fill()
  g.fillStyle = '#d6a84a'
  g.fillRect(cx - 15, y - 40, 30, 2)
}

const NOBORI: Record<string, { cloth: string; mark: string }> = {
  red: { cloth: '#d33a2c', mark: '#fff3dc' },
  teal: { cloth: '#1fa68f', mark: '#f6f1e2' },
  gold: { cloth: '#e9b030', mark: '#3a1c1a' },
}

function drawNobori(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + 14
  const c = NOBORI[p.variant ?? 'red'] ?? NOBORI.red!
  shadow(g, cx + 6, y + 44, 14, 5, 0.38)
  g.fillStyle = '#3b3566'
  g.beginPath()
  g.ellipse(cx, y + 42, 10, 4, 0, 0, TAU)
  g.fill()
  g.fillStyle = '#2b1c1c'
  g.fillRect(cx - 1.5, y - 46, 3, 90)
  g.fillStyle = '#e6b45a'
  g.beginPath()
  g.arc(cx, y - 47, 3, 0, TAU)
  g.fill()
  g.fillRect(cx - 1, y - 44, 22, 2.4)
  for (let i = 0; i < 22; i++) {
    const wave = Math.sin(time * 0.004 + i * 0.5 + p.col) * (0.8 + i * 0.12)
    g.fillStyle = c.cloth
    g.fillRect(cx + 1.5 + wave, y - 42 + i * 3, 17, 3.2)
    if (i === 5 || i === 6 || i === 7 || i === 8) {
      g.fillStyle = c.mark
      g.fillRect(cx + 5.5 + wave, y - 42 + i * 3, 9, 3.2)
    }
    if (i === 15 || i === 17) {
      g.fillStyle = c.mark
      g.fillRect(cx + 3 + wave, y - 42 + i * 3, 14, 1.6)
    }
  }
}

export const PROP_CATALOG: readonly PropDef[] = [
  { type: 'tree', label: 'Tree', w: 1, h: 1, solid: true, resize: 'none', variants: ['oak', 'sakura'], draw: drawTree },
  { type: 'plant', label: 'Potted plant', w: 1, h: 1, solid: true, resize: 'none', draw: drawPlant },
  { type: 'lantern', label: 'Lantern', w: 1, h: 1, solid: true, resize: 'none', draw: drawLantern },
  { type: 'campfire', label: 'Campfire', w: 1, h: 1, solid: true, resize: 'none', draw: drawCampfire },
  { type: 'fountain', label: 'Fountain', w: 2, h: 2, solid: true, resize: 'none', draw: drawFountain },
  { type: 'cafe_counter', label: 'Café counter', w: 3, h: 1, solid: true, resize: 'w', minW: 3, draw: drawCafeCounter },
  { type: 'bookshelf', label: 'Bookshelf', w: 2, h: 1, solid: true, resize: 'w', minW: 1, draw: drawBookshelf },
  { type: 'sofa_horiz', label: 'Sofa (walk-through)', w: 3, h: 1, solid: false, resize: 'w', minW: 2, color: '#f59e0b', draw: drawSofaHoriz },
  { type: 'round_table', label: 'Round table', w: 1, h: 1, solid: true, resize: 'none', draw: drawRoundTable },
  { type: 'media_table', label: 'Media table', w: 1, h: 1, solid: true, resize: 'none', draw: drawRoundTable },
  { type: 'pingpong', label: 'Ping-pong table', w: 2, h: 3, solid: true, resize: 'wh', minW: 1, minH: 1, draw: drawPingpong },
  { type: 'arcade', label: 'Arcade cabinet', w: 1, h: 1, solid: true, resize: 'none', color: '#06b6d4', draw: drawArcade },
  { type: 'desk_pod', label: 'Desk pod', w: 2, h: 1, solid: true, resize: 'w', minW: 1, draw: drawDeskPod },
  { type: 'picnic_table', label: 'Picnic table', w: 2, h: 1, solid: true, resize: 'w', minW: 1, draw: drawPicnicTable },
  { type: 'seat', label: 'Seat', w: 1, h: 1, solid: false, resize: 'none', hidden: true, draw: drawSeat },
  // ---- extended pack: Lodge / Zen Garden / Orbital (appended; existing types never change) ----
  { type: 'pine', label: 'Pine tree', w: 1, h: 1, solid: true, resize: 'none', variants: ['green', 'dark'], draw: drawPine },
  { type: 'maple', label: 'Maple tree', w: 1, h: 1, solid: true, resize: 'none', variants: ['red', 'gold', 'green'], draw: drawMaple },
  { type: 'bush', label: 'Bush', w: 1, h: 1, solid: true, resize: 'none', variants: ['green', 'flowering'], draw: drawBush },
  { type: 'rock', label: 'Boulder', w: 1, h: 1, solid: true, resize: 'w', minW: 1, variants: ['grey', 'mossy'], draw: drawRock },
  { type: 'firewood', label: 'Firewood stack', w: 1, h: 1, solid: true, resize: 'none', draw: drawFirewood },
  { type: 'stone_lantern', label: 'Stone lantern', w: 1, h: 1, solid: true, resize: 'none', draw: drawStoneLantern },
  { type: 'bamboo', label: 'Bamboo clump', w: 1, h: 1, solid: true, resize: 'w', minW: 1, draw: drawBamboo },
  { type: 'torii', label: 'Torii gate (stand it on solid tiles)', w: 4, h: 1, solid: false, resize: 'w', minW: 3, color: '#d6361f', draw: drawTorii },
  { type: 'shrine', label: 'Shrine', w: 3, h: 2, solid: true, resize: 'none', draw: drawShrine },
  { type: 'tent', label: 'Tent', w: 2, h: 2, solid: true, resize: 'none', color: '#f97316', draw: drawTent },
  { type: 'rowboat', label: 'Rowboat', w: 2, h: 1, solid: true, resize: 'none', color: '#b45309', draw: drawRowboat },
  { type: 'hot_tub', label: 'Hot tub / hot spring', w: 2, h: 2, solid: true, resize: 'wh', minW: 2, minH: 2, variants: ['wood', 'stone'], draw: drawHotTub },
  { type: 'fireplace', label: 'Fireplace (against a wall)', w: 3, h: 1, solid: true, resize: 'w', minW: 2, draw: drawFireplace },
  { type: 'bookcase', label: 'Bookcase', w: 2, h: 1, solid: true, resize: 'w', minW: 1, draw: bakedProp(drawBookcase) },
  { type: 'low_table', label: 'Low table', w: 2, h: 1, solid: true, resize: 'w', minW: 1, draw: drawLowTable },
  { type: 'console', label: 'Console', w: 1, h: 1, solid: true, resize: 'none', color: '#22d3ee', draw: drawConsole },
  { type: 'holo_table', label: 'Holo table', w: 2, h: 2, solid: true, resize: 'none', color: '#38bdf8', draw: drawHoloTable },
  { type: 'planter', label: 'Hydroponic planter', w: 3, h: 1, solid: true, resize: 'w', minW: 1, variants: ['leafy', 'berries'], draw: bakedProp(drawPlanter) },
  { type: 'reactor', label: 'Reactor core', w: 3, h: 3, solid: true, resize: 'none', color: '#38bdf8', draw: drawReactor },
  { type: 'telescope', label: 'Telescope', w: 1, h: 1, solid: true, resize: 'none', draw: drawTelescope },
  { type: 'solar_panel', label: 'Solar panel', w: 3, h: 2, solid: true, resize: 'wh', minW: 1, minH: 1, draw: drawSolarPanel },
  // ---- night market pack (appended; existing types never change) ----
  { type: 'stall', label: 'Market stall', w: 3, h: 2, solid: true, resize: 'w', minW: 2, variants: ['noodles', 'skewers', 'sweets', 'tea', 'toys', 'fruit', 'fortune', 'goldfish'], draw: drawStall, light: stallLight },
  { type: 'paper_lantern', label: 'Lantern post', w: 1, h: 1, solid: true, resize: 'none', variants: ['red', 'amber', 'jade'], draw: drawLanternPost, light: lanternPostLight },
  { type: 'string_lights', label: 'String lights (hang overhead)', w: 8, h: 1, solid: false, resize: 'wh', minW: 1, minH: 1, draw: () => {}, overhead: drawStringLights, light: stringLightsLight },
  { type: 'neon_sign', label: 'Neon sign', w: 2, h: 1, solid: false, resize: 'none', variants: ['bowl', 'fish', 'cup', 'moon', 'star'], draw: drawNeonSign, light: neonLight },
  { type: 'wishing_tree', label: 'Wishing tree', w: 3, h: 3, solid: true, resize: 'none', draw: drawWishingTree, light: wishingTreeLight },
  { type: 'night_table', label: 'Night-market table', w: 2, h: 1, solid: true, resize: 'w', minW: 1, draw: drawNightTable, light: nightTableLight },
  { type: 'crates', label: 'Crates, barrels, baskets', w: 1, h: 1, solid: true, resize: 'none', variants: ['crates', 'barrels', 'baskets'], draw: drawCrates },
  { type: 'floating_lantern', label: 'Floating lantern (pond or sky)', w: 1, h: 1, solid: false, resize: 'none', variants: ['pond', 'sky'], draw: drawFloatingLantern, light: floatingLanternLight },
  { type: 'pillar', label: 'Lacquer pillar', w: 1, h: 1, solid: true, resize: 'none', draw: drawPillar },
  { type: 'nobori', label: 'Banner flag', w: 1, h: 1, solid: true, resize: 'none', variants: ['red', 'teal', 'gold'], draw: drawNobori },
]

const BY_TYPE = new Map(PROP_CATALOG.map((d) => [d.type, d]))
export const propDef = (type: string): PropDef | undefined => BY_TYPE.get(type)

/** Draw one prop. Unknown types draw nothing (so a typo never crashes a room). */
export function drawProp(g: CanvasRenderingContext2D, p: Prop, time: number) {
  BY_TYPE.get(p.type)?.draw(g, p, time)
}

/**
 * Seats are walk-on spots (you sit when you stop on one). `sofa_cushion` draws nothing
 * on purpose: it is meant to sit on top of a `sofa_horiz`, which already draws the cushion.
 */
export const SEAT_STYLES = ['bench', 'stool', 'sofa_cushion', 'beanbag', 'office_chair', 'log_seat', 'armchair', 'deck_chair', 'zabuton'] as const
export type SeatStyle = (typeof SEAT_STYLES)[number]
