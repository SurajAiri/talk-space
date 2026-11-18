/**
 * Sitting, lying down and standing up: the rules, with no canvas, DOM or network in them, so they are unit-tested
 * and shared by the local avatar, every remote avatar and the editor.
 *
 * THE KEY IDEA: nothing about sitting is sent over the network. A person is "on a seat" when they are standing
 * still, exactly on that seat's anchor point (the tile centre). Everyone's screen works that out from the same
 * map and the same position messages, so everybody agrees, and older clients keep working. "Sit" is just an
 * action that walks you onto the anchor; "stand up" walks you off it.
 */
import { seatKind } from './assets/seats.ts'
import { isTileBlocked } from './navigation.ts'
import { TILE, type Dir, type Prop, type Seat, type WorldMap } from './types.ts'

/** How close to the anchor (px) counts as "on the seat". Walking in gets you to within 0.5; this leaves room for rounding. */
export const SNAP_PX = 4
/** How far (px) from a seat's anchor the "Sit" prompt shows up. */
export const REACH_PX = 1.7 * TILE

export const seatKey = (col: number, row: number) => `${col},${row}`

export function seatAnchor(s: Pick<Seat, 'col' | 'row'>): { x: number; y: number } {
  return { x: (s.col + 0.5) * TILE, y: (s.row + 0.5) * TILE }
}

export type SeatIndex = ReadonlyMap<string, Seat>

export function seatIndex(seats: readonly Seat[]): SeatIndex {
  const m = new Map<string, Seat>()
  for (const s of seats) m.set(seatKey(s.col, s.row), s)
  return m
}

/** The seat on the tile containing this point, if any (however far from its anchor). */
export function seatInTile(index: SeatIndex, x: number, y: number): Seat | null {
  return index.get(seatKey(Math.floor(x / TILE), Math.floor(y / TILE))) ?? null
}

/** The seat this person is sitting or lying on: standing still, exactly on its anchor. Same rule for you and for everyone else. */
export function seatedOn(index: SeatIndex, x: number, y: number, moving: boolean): Seat | null {
  if (moving) return null
  const s = seatInTile(index, x, y)
  if (!s) return null
  const a = seatAnchor(s)
  return Math.hypot(x - a.x, y - a.y) <= SNAP_PX ? s : null
}

/** The closest seat within reach that `free` accepts (not taken, not the one you just left...). */
export function nearestSeat(seats: readonly Seat[], x: number, y: number, free: (s: Seat) => boolean, reach = REACH_PX): Seat | null {
  let best: Seat | null = null
  let bestD = reach
  for (const s of seats) {
    const a = seatAnchor(s)
    const d = Math.hypot(a.x - x, a.y - y)
    if (d <= bestD && free(s)) {
      best = s
      bestD = d
    }
  }
  return best
}

const STEP: Record<Dir, { dc: number; dr: number }> = { up: { dc: 0, dr: -1 }, down: { dc: 0, dr: 1 }, left: { dc: -1, dr: 0 }, right: { dc: 1, dr: 0 } }
const TURN_LEFT: Record<Dir, Dir> = { down: 'right', right: 'up', up: 'left', left: 'down' }

/**
 * Where to step when you get up: the free tile in front of the seat first (that is the way you were facing), then
 * to its sides, then behind, then diagonals. Never a seat (you would just sit down again) and never a wall.
 */
export function exitTile(map: WorldMap, index: SeatIndex, seat: Seat): { col: number; row: number } | null {
  const front = STEP[seat.dir]
  const left = STEP[TURN_LEFT[seat.dir]]
  const order: [number, number][] = [
    [front.dc, front.dr],
    [left.dc, left.dr],
    [-left.dc, -left.dr],
    [-front.dc, -front.dr],
    [front.dc + left.dc, front.dr + left.dr],
    [front.dc - left.dc, front.dr - left.dr],
    [-front.dc + left.dc, -front.dr + left.dr],
    [-front.dc - left.dc, -front.dr - left.dr],
  ]
  for (const [dc, dr] of order) {
    const col = seat.col + dc
    const row = seat.row + dr
    if (isTileBlocked(map, col, row) || index.has(seatKey(col, row))) continue
    // a diagonal needs both of its neighbours open, or we would cut a corner through a wall
    if (dc !== 0 && dr !== 0 && (isTileBlocked(map, seat.col + dc, seat.row) || isTileBlocked(map, seat.col, seat.row + dr))) continue
    return { col, row }
  }
  return null
}

// ---- how the map's seats and furniture are laid out ----------------------------------------------------------------

/** Styles that continue into a neighbour of the same kind: a row of benches is drawn as one long bench. */
const JOINS = new Set(['bench'])

/** Sets `join` on every seat whose neighbour (to its left or right, as the sitter sees it) is the same style facing the same way. */
export function computeSeatJoins(seats: Seat[]) {
  const index = seatIndex(seats)
  const angle: Record<Dir, number> = { down: 0, left: Math.PI / 2, up: Math.PI, right: -Math.PI / 2 }
  for (const s of seats) {
    if (!JOINS.has(s.style)) continue
    const a = angle[s.dir]
    // local "left" is -x of the seat's own frame, which the seat's rotation maps to (-cos, -sin) on the map
    const dc = Math.round(Math.cos(a))
    const dr = Math.round(Math.sin(a))
    const same = (c: number, r: number) => {
      const n = index.get(seatKey(c, r))
      return Boolean(n && n.style === s.style && n.dir === s.dir)
    }
    const left = same(s.col - dc, s.row - dr)
    const right = same(s.col + dc, s.row + dr)
    if (left || right) s.join = { left, right }
    else delete s.join
  }
}

/** The way a prop faces: where the seats standing on it look (a sofa faces its cushions' way). Default: down. */
export function facingFromSeats(p: Prop, seats: readonly Seat[]): Dir {
  const votes: Record<Dir, number> = { up: 0, down: 0, left: 0, right: 0 }
  for (const s of seats) if (s.col >= p.col && s.col < p.col + p.w && s.row >= p.row && s.row < p.row + p.h) votes[s.dir]++
  let best: Dir = 'down'
  for (const d of ['up', 'left', 'right'] as const) if (votes[d] > votes[best]) best = d
  return best
}

// ---- the button -------------------------------------------------------------------------------------------------

export interface Prompt {
  kind: 'sit' | 'stand'
  seat: Seat
  /** "Sit", "Lie down", "Stand up", "Get up" */
  label: string
}

/** What the on-screen action says: stand up if you are seated, else the nearest free seat's verb ("Sit", "Lie down"). */
export function promptFor(seated: Seat | null, near: Seat | null): Prompt | null {
  if (seated) return { kind: 'stand', seat: seated, label: seatKind(seated.style).posture === 'lie' ? 'Get up' : 'Stand up' }
  if (near) return { kind: 'sit', seat: near, label: seatKind(near.style).verb }
  return null
}
