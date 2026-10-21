/** World coordinates: 1 tile = TILE pixels. Network messages use TILE units so they never depend on rendering. */
export const TILE = 48
export const MAP_COLS = 44
export const MAP_ROWS = 32

export type Dir = 'up' | 'down' | 'left' | 'right'
export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right']

export interface Seat {
  id: string
  col: number
  row: number
  dir: Dir
  style: string
  color: string
}

export interface Prop {
  col: number
  row: number
  w: number
  h: number
  type: string
  solid: boolean
  seat?: Seat
  color?: string
  kind?: string
}

/** Inclusive tile rectangle. */
export interface Rect {
  c1: number
  r1: number
  c2: number
  r2: number
}

/**
 * An enclosed or deliberately distinct area. Everyone standing inside the SAME zone
 * hears each other at full volume regardless of distance, and nobody outside hears them.
 * Everything that is not in a zone is the "open area" (proximity audio).
 */
export interface Zone {
  id: string
  name: string
  rect: Rect
}

export interface WorldMap {
  key: string
  title: string
  grid: number[][]
  props: Prop[]
  seats: Seat[]
  zones: Zone[]
  spawn: { col: number; row: number }
}

/** What the renderer needs to draw one person. */
export interface Character {
  id: string
  name: string
  flair: string
  status: 'available' | 'busy' | 'vibing'
  isPlayer: boolean
  x: number // pixels
  y: number // pixels
  dir: Dir
  moving: boolean
  walkFrame: number
  dancing: boolean
  sittingSeat: Seat | null
  skin: string
  hairStyle: string
  hairColor: string
  shirt: string
  pants: string
  accessory: string
  speechBubble: { text: string; timer: number } | null
  reaction: { emoji: string; timer: number; scale: number } | null
}
