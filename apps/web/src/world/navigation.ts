import { tileById } from './assets/tiles.ts'
import { TILE, type WorldMap } from './types.ts'

const blockedCache = new WeakMap<WorldMap, Uint8Array>()

/** Solid tiles (walls, water, ...) and solid props block walking. Computed once per map. */
function blockedGrid(map: WorldMap): Uint8Array {
  let b = blockedCache.get(map)
  if (b) return b
  b = new Uint8Array(map.cols * map.rows)
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (tileById(map.grid[r]![c]!)?.solid) b[r * map.cols + c] = 1
    }
  }
  for (const p of map.props) {
    if (!p.solid) continue
    for (let r = p.row; r < p.row + p.h; r++) {
      for (let c = p.col; c < p.col + p.w; c++) {
        if (r >= 0 && r < map.rows && c >= 0 && c < map.cols) b[r * map.cols + c] = 1
      }
    }
  }
  blockedCache.set(map, b)
  return b
}

export function isTileBlocked(map: WorldMap, col: number, row: number): boolean {
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return true
  return blockedGrid(map)[row * map.cols + col] === 1
}

export interface Waypoint {
  x: number // pixels (tile centre)
  y: number
}

/**
 * Shortest 8-way path between tiles (BFS), without cutting corners through walls.
 * Returns tile-centre waypoints excluding the start, or null if unreachable.
 */
export function findPath(
  map: WorldMap,
  from: { col: number; row: number },
  to: { col: number; row: number },
): Waypoint[] | null {
  if (isTileBlocked(map, to.col, to.row)) return null
  if (from.col === to.col && from.row === to.row) return []

  const COLS = map.cols
  const idx = (c: number, r: number) => r * COLS + c
  const prev = new Int32Array(COLS * map.rows).fill(-2) // -2 unvisited, -1 start
  const queue: number[] = [idx(from.col, from.row)]
  prev[queue[0]!] = -1
  const goal = idx(to.col, to.row)
  const steps = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ] as const

  for (let head = 0; head < queue.length && prev[goal] === -2; head++) {
    const cur = queue[head]!
    const c = cur % COLS
    const r = Math.floor(cur / COLS)
    for (const [dc, dr] of steps) {
      const nc = c + dc
      const nr = r + dr
      if (isTileBlocked(map, nc, nr)) continue
      // diagonal moves need both orthogonal neighbours free, or we would clip a corner
      if (dc !== 0 && dr !== 0 && (isTileBlocked(map, c + dc, r) || isTileBlocked(map, c, r + dr))) continue
      const n = idx(nc, nr)
      if (prev[n] !== -2) continue
      prev[n] = cur
      queue.push(n)
    }
  }
  if (prev[goal] === -2) return null

  const path: Waypoint[] = []
  for (let cur = goal; cur !== -1; cur = prev[cur]!) {
    if (prev[cur] === -1) break // reached the start tile; it is not a waypoint
    path.push({ x: ((cur % COLS) + 0.5) * TILE, y: (Math.floor(cur / COLS) + 0.5) * TILE })
  }
  return path.reverse()
}

/** Flood fill (4-way) of every tile reachable by walking from `from`. 1 = reachable. */
export function reachableFrom(map: WorldMap, from: { col: number; row: number }): Uint8Array {
  const seen = new Uint8Array(map.cols * map.rows)
  if (isTileBlocked(map, from.col, from.row)) return seen
  const stack = [from.row * map.cols + from.col]
  seen[stack[0]!] = 1
  while (stack.length) {
    const cur = stack.pop()!
    const c = cur % map.cols
    const r = Math.floor(cur / map.cols)
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc
      const nr = r + dr
      if (isTileBlocked(map, nc, nr)) continue
      const n = nr * map.cols + nc
      if (seen[n]) continue
      seen[n] = 1
      stack.push(n)
    }
  }
  return seen
}
