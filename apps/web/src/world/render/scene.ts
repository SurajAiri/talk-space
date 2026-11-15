import { drawProp, propDef, type Light } from '../assets/props.ts'
import { drawTile } from '../assets/tiles.ts'
import { TILE, type Prop } from '../types.ts'

/** Draw tiles [startCol..endCol] x [startRow..endRow] (inclusive) of a tile-id grid. */
export function drawWorldTiles(
  g: CanvasRenderingContext2D,
  grid: number[][],
  startCol: number,
  endCol: number,
  startRow: number,
  endRow: number,
  time: number,
) {
  for (let r = startRow; r <= endRow; r++) {
    const row = grid[r]
    if (!row) continue
    for (let c = startCol; c <= endCol; c++) {
      const id = row[c]
      if (id !== undefined) drawTile(g, id, c, r, time)
    }
  }
}

export { drawProp as drawPropItem }

// ---- the night layer: light pools and things you walk under --------------------------------------
// A map is lit by its props (PropDef.light / PropDef.overhead). Daytime maps have no such props, so for them
// this whole layer costs one empty loop.

/** The props of a map that throw light or hang overhead: worked out once per map, not once per frame. */
export function nightPropsOf(props: readonly Prop[]): Prop[] {
  return props.filter((p) => {
    const d = propDef(p.type)
    return Boolean(d?.light || d?.overhead)
  })
}

/** What part of the world is on screen, in world pixels; lights and strings outside it are skipped. */
export interface WorldRect {
  x1: number
  y1: number
  x2: number
  y2: number
}

const GLOW_PX = 128
const glowSprites = new Map<string, CanvasImageSource>()

/** One soft round gradient per colour, painted once; every pool of that colour is this bitmap, scaled. */
function glowSprite(rgb: string): CanvasImageSource | null {
  const hit = glowSprites.get(rgb)
  if (hit) return hit
  const surface =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(GLOW_PX, GLOW_PX)
      : typeof document !== 'undefined'
        ? Object.assign(document.createElement('canvas'), { width: GLOW_PX, height: GLOW_PX })
        : null
  const sg = surface?.getContext('2d') as CanvasRenderingContext2D | null | undefined
  if (!surface || !sg) return null
  const h = GLOW_PX / 2
  const grad = sg.createRadialGradient(h, h, 0, h, h, h)
  grad.addColorStop(0, `rgba(${rgb}, 1)`)
  grad.addColorStop(0.18, `rgba(${rgb}, 0.6)`)
  grad.addColorStop(0.45, `rgba(${rgb}, 0.22)`)
  grad.addColorStop(0.75, `rgba(${rgb}, 0.06)`)
  grad.addColorStop(1, `rgba(${rgb}, 0)`)
  sg.fillStyle = grad
  sg.fillRect(0, 0, GLOW_PX, GLOW_PX)
  glowSprites.set(rgb, surface)
  return surface
}

const pending: Light[] = []
const emit = (l: Light) => void pending.push(l)

/**
 * Draws, in this order: everything hung above people (string lights...), then every pool of light, added
 * on top (`lighter`), so lanterns brighten the stone under them and a person standing near one is lit too.
 * Call once per frame after the depth-sorted props and people, before name tags and speech bubbles.
 */
export function drawNight(g: CanvasRenderingContext2D, night: readonly Prop[], time: number, view?: WorldRect) {
  if (night.length === 0) return
  pending.length = 0
  for (const p of night) {
    if (view && (p.col * TILE > view.x2 + 220 || (p.col + p.w) * TILE < view.x1 - 220 || p.row * TILE > view.y2 + 220 || (p.row + p.h) * TILE < view.y1 - 220)) continue
    const d = propDef(p.type)
    d?.overhead?.(g, p, time)
    d?.light?.(p, time, emit)
  }
  if (pending.length === 0) return
  g.save()
  g.globalCompositeOperation = 'lighter'
  for (const l of pending) {
    if (view && (l.x + l.r < view.x1 || l.x - l.r > view.x2 || l.y + l.r < view.y1 || l.y - l.r > view.y2)) continue
    const sprite = glowSprite(l.rgb)
    g.globalAlpha = Math.min(1, l.a)
    if (sprite) g.drawImage(sprite, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2)
  }
  g.restore()
  pending.length = 0
}
