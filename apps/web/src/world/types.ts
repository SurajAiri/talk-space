/** World coordinates: 1 tile = TILE pixels. Network messages use TILE units so they never depend on rendering. */
export const TILE = 48

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
  /** named look from the prop's catalog entry (e.g. tree: oak | sakura) */
  variant?: string
  /** tint, only for props whose catalog entry declares a default colour */
  color?: string
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
  description?: string
  cols: number
  rows: number
  /** tile ids, grid[row][col] */
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
  /** `age` and `timer` (time left) are in ms; `dm` = a private message. */
  speechBubble: { text: string; dm: boolean; age: number; timer: number } | null
  reaction: { emoji: string; timer: number; scale: number } | null
}
