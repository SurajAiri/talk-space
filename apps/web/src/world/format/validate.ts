/**
 * Semantic checks on a structurally valid MapFile: the things that make a map *feel* broken
 * even though the JSON is fine (unreachable rooms, zones you cannot enter, blocked spawn).
 */
import { isTileBlocked, reachableFrom } from '../navigation.ts'
import { propDef } from '../assets/props.ts'
import { zoneAt } from '../hearing.ts'
import { buildWorldMap, type Issue, type MapFile } from './mapFile.ts'

export function validateMap(file: MapFile): Issue[] {
  const issues: Issue[] = []
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message })
  const warn = (path: string, message: string) => issues.push({ level: 'warning', path, message })
  const map = buildWorldMap(file)
  const { cols, rows } = map
  const [sc, sr] = file.spawn

  // ---- spawn
  if (sc < 0 || sr < 0 || sc >= cols || sr >= rows) err('spawn', `(${sc},${sr}) is outside the ${cols}x${rows} map`)
  else if (isTileBlocked(map, sc, sr)) err('spawn', `(${sc},${sr}) is blocked (wall, water or a solid prop)`)
  else {
    if (zoneAt(map, sc + 0.5, sr + 0.5)) warn('spawn', 'spawn is inside a zone: new arrivals will be isolated in it. Put it in the open area')
    let free = 0
    for (let r = sr - 3; r <= sr + 3; r++) for (let c = sc - 3; c <= sc + 3; c++) if (!isTileBlocked(map, c, r) && !zoneAt(map, c + 0.5, r + 0.5)) free++
    if (free < 12) warn('spawn', `only ${free} free open tiles within 3 tiles of spawn; arrivals will bunch up (want >= 12)`)
  }

  // With an unusable spawn every reachability result would be noise, so say so once and skip them.
  const spawnUsable = sc >= 0 && sr >= 0 && sc < cols && sr < rows && !isTileBlocked(map, sc, sr)
  const reach = spawnUsable ? reachableFrom(map, { col: sc, row: sr }) : new Uint8Array(cols * rows)
  const reachable = (c: number, r: number) => !spawnUsable || reach[r * cols + c] === 1

  // ---- unreachable walkable area
  let walkable = 0
  let cutOff = 0
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!isTileBlocked(map, c, r)) { walkable++; if (!reachable(c, r)) cutOff++ }
  if (walkable === 0) err('tiles', 'no walkable tiles at all')
  else if (spawnUsable && cutOff > 0) warn('tiles', `${cutOff} of ${walkable} walkable tiles cannot be reached from spawn (closed-off areas)`)

  // ---- zones
  file.zones.forEach((z, i) => {
    const at = `zones[${i}] "${z.id}"`
    const [c1, r1, c2, r2] = z.rect
    let free = 0
    let canEnter = false
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
      if (isTileBlocked(map, c, r)) continue
      free++
      if (reachable(c, r)) canEnter = true
    }
    if (free === 0) err(at, 'contains no walkable tile')
    else if (!canEnter) err(at, 'no tile inside can be reached from spawn (is the door blocked?)')
    else if (free < 6) warn(at, `only ${free} walkable tiles; too small to hold a conversation`)
    for (let j = i + 1; j < file.zones.length; j++) {
      const [d1, e1, d2, e2] = file.zones[j]!.rect
      if (!(c2 < d1 || d2 < c1 || r2 < e1 || e2 < r1)) err(at, `overlaps zone "${file.zones[j]!.id}" (hearing would depend on list order)`)
    }
  })

  // ---- props
  file.props.forEach((p, i) => {
    const at = `props[${i}] ${p.type}`
    const d = propDef(p.type)!
    const w = p.w ?? d.w
    const h = p.h ?? d.h
    if (p.col < 0 || p.row < 0 || p.col + w > cols || p.row + h > rows) err(at, `footprint (${p.col},${p.row}) ${w}x${h} leaves the map`)
  })
  const solid = map.props.filter((p) => p.solid && p.type !== 'seat')
  for (let a = 0; a < solid.length; a++) for (let b = a + 1; b < solid.length; b++) {
    const A = solid[a]!, B = solid[b]!
    if (A.col < B.col + B.w && B.col < A.col + A.w && A.row < B.row + B.h && B.row < A.row + A.h) warn(`props ${A.type}@${A.col},${A.row}`, `overlaps solid ${B.type}@${B.col},${B.row}`)
  }

  // ---- seats
  const seen = new Set<string>()
  file.seats.forEach((s, i) => {
    const at = `seats[${i}]`
    if (s.col < 0 || s.row < 0 || s.col >= cols || s.row >= rows) return err(at, `(${s.col},${s.row}) is outside the map`)
    const k = `${s.col},${s.row}`
    if (seen.has(k)) warn(at, `another seat is already at (${k})`)
    seen.add(k)
    if (isTileBlocked(map, s.col, s.row)) warn(at, `(${k}) is blocked, nobody can sit here`)
    else if (!reachable(s.col, s.row)) warn(at, `(${k}) cannot be reached from spawn`)
  })

  return issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
}
