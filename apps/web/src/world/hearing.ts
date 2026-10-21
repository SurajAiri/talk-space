import type { WorldMap, Zone } from './types'

/** Position in tile units (floats). */
export interface Pos {
  x: number
  y: number
}

/**
 * Open-area hearing, in tiles. Inside `fullRadius` you hear someone at full volume;
 * beyond `maxRadius` not at all; in between volume falls off quadratically.
 * (Quadratic ~ "perceived loudness drops fast, then tails off", and is trivially tunable.)
 */
export const HEARING = { fullRadius: 2, maxRadius: 7 } as const

export function zoneAt(map: WorldMap, x: number, y: number): Zone | null {
  const col = Math.floor(x)
  const row = Math.floor(y)
  for (const z of map.zones) {
    const r = z.rect
    if (col >= r.c1 && col <= r.c2 && row >= r.r1 && row <= r.r2) return z
  }
  return null
}

/**
 * How loudly `listener` hears `speaker`, 0..1. The function is symmetric, so both
 * sides of a conversation always agree on whether they can hear each other.
 *
 *   both in the SAME zone        -> 1 (distance is irrelevant)
 *   exactly one of them in a zone,
 *   or in two DIFFERENT zones    -> 0 (a zone is isolated from everything outside it)
 *   both in the open area        -> distance falloff
 *
 * The "zone <-> outside = silent" rule is a product decision. If you want people
 * standing in a doorway to leak into the zone, change it here and nowhere else.
 */
export function hearingGain(map: WorldMap, listener: Pos, speaker: Pos): number {
  const zl = zoneAt(map, listener.x, listener.y)
  const zs = zoneAt(map, speaker.x, speaker.y)
  if (zl || zs) return zl && zs && zl.id === zs.id ? 1 : 0

  const d = Math.hypot(listener.x - speaker.x, listener.y - speaker.y)
  if (d <= HEARING.fullRadius) return 1
  if (d >= HEARING.maxRadius) return 0
  const t = (HEARING.maxRadius - d) / (HEARING.maxRadius - HEARING.fullRadius)
  return t * t
}
