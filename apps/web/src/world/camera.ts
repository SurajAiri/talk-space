import { TILE } from './types.ts'

/**
 * How far people may zoom, and how the wheel turns into zoom. Pure maths, no DOM, so it can be tested.
 *
 * The old fixed 0.5x..2x range let a laptop zoom out until the WHOLE map was on screen, which defeats the
 * point of a map you walk around (and shows people who are far outside earshot as if they were close).
 * Now the zoom-out limit is about how much you may SEE: never more than MAX_VISIBLE_TILES tiles at once,
 * whatever the screen shape. That is roughly 30 x 17 tiles on a 1080p monitor, a phone keeps about what it
 * had, and a small window is never forced closer than it was.
 */
export const MAX_VISIBLE_TILES = 520
/** Closest zoom: a person is 1.8x their normal size. */
export const MAX_ZOOM = 1.8
/** Hard floor, so a huge canvas cannot ask for a nonsense value. */
const ABS_MIN_ZOOM = 0.4
/** The comfortable starting view: about this many tiles top to bottom AND across, whichever is tighter. */
const FIT_TILES_TALL = 12
const FIT_TILES_WIDE = 9

export interface ZoomLimits {
  min: number
  max: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function zoomLimits(cssW: number, cssH: number, mapCols: number, mapRows: number): ZoomLimits {
  const byArea = Math.sqrt((cssW * cssH) / (MAX_VISIBLE_TILES * TILE * TILE))
  // zooming out past the point where the whole map fits only adds empty space around it
  const contain = Math.min(cssW / (mapCols * TILE), cssH / (mapRows * TILE))
  const min = Math.min(Math.max(byArea, contain, ABS_MIN_ZOOM), MAX_ZOOM)
  return { min, max: Math.max(MAX_ZOOM, min) }
}

export const clampZoom = (zoom: number, limits: ZoomLimits) => clamp(zoom, limits.min, limits.max)

/** The zoom a room opens at (and returns to on resize until someone zooms by hand), always inside the limits. */
export function fitZoom(cssW: number, cssH: number, limits: ZoomLimits): number {
  const fit = Math.min(cssH / (FIT_TILES_TALL * TILE), cssW / (FIT_TILES_WIDE * TILE))
  return clampZoom(clamp(fit, 0.7, 1.3), limits)
}

/**
 * Multiplier for one wheel event. Proportional to how far the wheel moved: a mouse notch (about 100) zooms
 * ~16%, while a trackpad pinch sends dozens of tiny events (a few units each) that add up smoothly instead of
 * each one slamming the zoom by a fixed 10%.
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 100 : deltaY
  return Math.exp(-clamp(px, -120, 120) * 0.0015)
}
