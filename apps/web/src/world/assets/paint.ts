/**
 * Small painting helpers shared by the prop art (props.ts, seats.ts, furniture.ts).
 * Pure canvas calls, no DOM or app imports, so the whole `assets/` folder stays copy-pasteable.
 *
 * The house style, so new art matches the old: a soft ground shadow, a top face in the base colour, a darker
 * front face (the thickness you see from a 3/4 camera), a pale highlight along the top-left edge, then details.
 */

export type Ctx = CanvasRenderingContext2D

export const TAU = Math.PI * 2

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Lighten (amt > 0, towards white) or darken (amt < 0, towards black) a #rrggbb colour. Returns #rrggbb. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (c: number) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

/** Blend two #rrggbb colours (t = 0 is `a`, 1 is `b`). */
export function mix(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16)
  const y = parseInt(b.slice(1), 16)
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t)
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`
}

/** #rrggbb + alpha -> rgba(). */
export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Deterministic noise in [0, 1) from a cell position. */
export function noise(c: number, r: number, k = 0): number {
  let h = Math.imul(c + 1013, 374761393) ^ Math.imul(r + 7919, 668265263) ^ Math.imul(k + 17, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1103515245)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Soft elliptical ground shadow. */
export function shadow(g: Ctx, cx: number, cy: number, rx: number, ry: number, a = 0.28) {
  g.fillStyle = `rgba(15, 23, 42, ${a})`
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU)
  g.fill()
}

/** Filled rounded rectangle. */
export function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  g.fillStyle = fill
  g.beginPath()
  g.roundRect(x, y, w, h, r)
  g.fill()
}

export function ellipse(g: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string) {
  g.fillStyle = fill
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, 0, TAU)
  g.fill()
}

export function circle(g: Ctx, cx: number, cy: number, r: number, fill: string) {
  g.fillStyle = fill
  g.beginPath()
  g.arc(cx, cy, r, 0, TAU)
  g.fill()
}

export function tri(g: Ctx, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  g.beginPath()
  g.moveTo(ax, ay)
  g.lineTo(bx, by)
  g.lineTo(cx, cy)
  g.closePath()
  g.fill()
}

export function line(g: Ctx, x1: number, y1: number, x2: number, y2: number, stroke: string, width: number, cap: CanvasLineCap = 'round') {
  g.strokeStyle = stroke
  g.lineWidth = width
  g.lineCap = cap
  g.beginPath()
  g.moveTo(x1, y1)
  g.lineTo(x2, y2)
  g.stroke()
}

/**
 * A chunky 3/4-view block: a top face of height `h` and a front face `depth` px tall under it, so it reads as a
 * solid object and not a flat decal. Returns nothing; details go on top of the face at (x, y, w, h).
 */
export function block(g: Ctx, x: number, y: number, w: number, h: number, depth: number, top: string, r = 4, front = shade(top, -0.34)) {
  rr(g, x, y + depth, w, h, r, front)
  rr(g, x, y, w, h, r, top)
  g.fillStyle = 'rgba(255, 255, 255, 0.2)'
  g.beginPath()
  g.roundRect(x + 1.5, y + 1, w - 3, Math.min(2.4, h / 3), 1.5)
  g.fill()
}

/** A soft pool of warm glow; additive, so it only ever brightens. Safe on any background. */
export function glow(g: Ctx, cx: number, cy: number, r: number, rgb: string, a: number) {
  g.save()
  g.globalCompositeOperation = 'lighter'
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r)
  grad.addColorStop(0, `rgba(${rgb}, ${a})`)
  grad.addColorStop(0.45, `rgba(${rgb}, ${a * 0.35})`)
  grad.addColorStop(1, `rgba(${rgb}, 0)`)
  g.fillStyle = grad
  g.fillRect(cx - r, cy - r, r * 2, r * 2)
  g.restore()
}

/**
 * Cache for art that never changes. `paint` is run ONCE per distinct `key` into a bitmap which is then blitted;
 * `pad` px of margin on every side let the art spill past its tile. Falls back to painting directly when the
 * environment has no offscreen surface (plain Node without a canvas shim), so nothing ever fails to draw.
 *
 * `paint` draws in a frame whose origin is the top-left of the `w` x `h` box (NOT world coordinates).
 */
export function bakedSprite(w: number, h: number, pad: number) {
  const cache = new Map<string, CanvasImageSource | null>()
  return (g: Ctx, x: number, y: number, key: string, paint: (g: Ctx) => void) => {
    const m = typeof g.getTransform === 'function' ? g.getTransform() : null
    const k = Math.min(3, Math.max(1, Math.ceil((m ? Math.hypot(m.a, m.b) : 2) - 0.05)))
    const id = `${k}|${key}`
    let bmp = cache.get(id)
    if (bmp === undefined) {
      const pw = w + pad * 2
      const ph = h + pad * 2
      const s =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(pw * k, ph * k)
          : typeof document !== 'undefined'
            ? Object.assign(document.createElement('canvas'), { width: pw * k, height: ph * k })
            : null
      const sg = s?.getContext('2d') as Ctx | null | undefined
      if (s && sg) {
        sg.scale(k, k)
        sg.translate(pad, pad)
        paint(sg)
        bmp = s
      } else bmp = null
      cache.set(id, bmp)
    }
    if (bmp) {
      g.drawImage(bmp, x - pad, y - pad, w + pad * 2, h + pad * 2)
    } else {
      g.save()
      g.translate(x, y)
      paint(g)
      g.restore()
    }
  }
}
