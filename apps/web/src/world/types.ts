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
  /**
   * Neighbouring seats of the same style and direction, in the seat's own frame (left/right as seen by someone
   * sitting in it). Set by buildWorldMap so a row of benches is drawn as ONE long bench. Absent = stands alone.
   */
  join?: { left: boolean; right: boolean }
  /** RUNTIME ONLY, set by the engine every frame: someone is sitting here (beanbags squash, cushions dent). */
  taken?: boolean
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
  /**
   * Which way it faces. Worked out by buildWorldMap from the seats on top of it (a sofa faces where its cushions
   * look), only for props whose catalog entry says `faces`. Absent = down.
   */
  facing?: Dir
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
  /**
   * 0..1: how far into the seat they are (the engine eases it up over a fraction of a second after they settle), so
   * sitting down and lying down are animated instead of a pop. Absent = fully settled.
   */
  sitT?: number
  skin: string
  hairStyle: string
  hairColor: string
  shirt: string
  /** tee | hoodie | stripes | jacket (absent = tee) */
  shirtStyle?: string
  pants: string
  accessory: string
  /** The animation being played right now (world/fx.ts), `age` = ms since it started. */
  emote?: { id: string; age: number } | null
  /** `age` and `timer` (time left) are in ms; `dm` = a private message. */
  speechBubble: { text: string; dm: boolean; age: number; timer: number } | null
  reaction: Reaction | null
}

/** An emoji burst or a word in big animated letters above someone's head (world/fx.ts). Times in ms. */
export interface Reaction {
  kind: 'emoji' | 'text'
  text: string
  style: string
  color: string
  age: number
  timer: number
}
