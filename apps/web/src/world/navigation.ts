import { MAP_COLS, MAP_ROWS, TILE, type WorldMap } from './types'

const blockedCache = new WeakMap<WorldMap, Uint8Array>()

/** Walls (5) and water (6) block, as do solid props. Computed once per map. */
function blockedGrid(map: WorldMap): Uint8Array {
  let b = blockedCache.get(map)
  if (b) return b
  b = new Uint8Array(MAP_COLS * MAP_ROWS)
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const t = map.grid[r]?.[c]
      if (t === 5 || t === 6) b[r * MAP_COLS + c] = 1
    }
  }
  for (const p of map.props) {
    if (!p.solid) continue
    for (let r = p.row; r < p.row + p.h; r++) {
      for (let c = p.col; c < p.col + p.w; c++) {
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) b[r * MAP_COLS + c] = 1
      }
    }
  }
  blockedCache.set(map, b)
  return b
}

export function isTileBlocked(map: WorldMap, col: number, row: number): boolean {
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return true
  return blockedGrid(map)[row * MAP_COLS + col] === 1
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

  const idx = (c: number, r: number) => r * MAP_COLS + c
  const prev = new Int32Array(MAP_COLS * MAP_ROWS).fill(-2) // -2 unvisited, -1 start
  const queue: number[] = [idx(from.col, from.row)]
  prev[queue[0]!] = -1
  const goal = idx(to.col, to.row)
  const steps = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ] as const

  for (let head = 0; head < queue.length && prev[goal] === -2; head++) {
    const cur = queue[head]!
    const c = cur % MAP_COLS
    const r = Math.floor(cur / MAP_COLS)
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
    path.push({ x: ((cur % MAP_COLS) + 0.5) * TILE, y: (Math.floor(cur / MAP_COLS) + 0.5) * TILE })
  }
  return path.reverse()
}
