/**
 * THE MAP FILE FORMAT (version 1). One JSON file per map in `maps/data/<key>.map.json`.
 *
 * Designed to be edited three ways: by the GUI editor, by a person in a text editor, and by
 * an AI. So: tiles are rows of single characters (see assets/tiles.ts for the legend),
 * everything else is short flat records, and every problem is reported with a path.
 *
 * Pure TypeScript with no DOM/Vite imports: runs in the browser, in Vite config and in
 * plain Node (`node tools/maps.ts`).
 */
import { propDef, SEAT_STYLES } from '../assets/props.ts'
import { DEFAULT_TILE, tileByChar } from '../assets/tiles.ts'
import { DIRS, type Dir, type Prop, type Seat, type WorldMap } from '../types.ts'

export const MAP_FORMAT_VERSION = 1
/** Keys double as file names and as the value stored on a room, so keep them boring. */
export const MAP_KEY_REGEX = /^[a-z0-9][a-z0-9_-]{0,31}$/
export const MAP_LIMITS = { minSize: 8, maxSize: 120, maxProps: 2000, maxSeats: 500, maxZones: 40 } as const
const ID_REGEX = /^[a-z0-9][a-z0-9_-]{0,31}$/
const COLOR_REGEX = /^#[0-9a-fA-F]{6}$/
export const DEFAULT_SEAT_COLOR = '#6366f1'

export interface MapFileProp {
  type: string
  col: number
  row: number
  /** omitted = the catalog default */
  w?: number
  h?: number
  /** omitted = the catalog default */
  solid?: boolean
  variant?: string
  /** #rrggbb, only for tintable props; omitted = the catalog default */
  color?: string
}
export interface MapFileSeat {
  col: number
  row: number
  dir: Dir
  style: string
  color?: string
}
export interface MapFileZone {
  id: string
  name: string
  /** inclusive tile rectangle: [col1, row1, col2, row2] */
  rect: [number, number, number, number]
}
export interface MapFile {
  format: typeof MAP_FORMAT_VERSION
  key: string
  title: string
  description?: string
  size: { cols: number; rows: number }
  /** [col, row] where people appear (a free tile in the open area) */
  spawn: [number, number]
  /** `size.rows` strings of exactly `size.cols` characters */
  tiles: string[]
  props: MapFileProp[]
  seats: MapFileSeat[]
  zones: MapFileZone[]
}

export interface Issue {
  level: 'error' | 'warning'
  /** where, e.g. `tiles[3][10]` or `props[7].type` */
  path: string
  message: string
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Structural validation + normalisation of untrusted JSON. Collects ALL problems (never
 * stops at the first). Returns `map: null` if any error makes the file unusable.
 * Semantic checks (reachability, overlaps...) live in validate.ts.
 */
export function parseMapFile(input: unknown): { map: MapFile | null; issues: Issue[] } {
  const issues: Issue[] = []
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message })
  const warn = (path: string, message: string) => issues.push({ level: 'warning', path, message })

  if (!isObj(input)) return { map: null, issues: [{ level: 'error', path: '', message: 'map file must be a JSON object' }] }
  const o = input

  const known = new Set(['format', 'key', 'title', 'description', 'size', 'spawn', 'tiles', 'props', 'seats', 'zones', '$schema'])
  for (const k of Object.keys(o)) if (!known.has(k)) warn(k, 'unknown field (ignored)')

  if (o.format !== MAP_FORMAT_VERSION) err('format', `must be ${MAP_FORMAT_VERSION}`)
  const key = typeof o.key === 'string' ? o.key : ''
  if (!MAP_KEY_REGEX.test(key)) err('key', 'must match ^[a-z0-9][a-z0-9_-]{0,31}$ (lowercase letters, digits, - and _)')
  const title = typeof o.title === 'string' ? o.title.trim() : ''
  if (title.length < 1 || title.length > 60) err('title', 'must be 1-60 characters')
  let description: string | undefined
  if (o.description !== undefined) {
    if (typeof o.description !== 'string' || o.description.length > 200) err('description', 'must be a string of at most 200 characters')
    else description = o.description
  }

  // ---- size + tiles
  let cols = 0
  let rows = 0
  if (!isObj(o.size) || !isInt(o.size.cols) || !isInt(o.size.rows)) err('size', 'must be { "cols": int, "rows": int }')
  else {
    cols = o.size.cols
    rows = o.size.rows
    const { minSize, maxSize } = MAP_LIMITS
    if (cols < minSize || cols > maxSize) err('size.cols', `must be ${minSize}-${maxSize}`)
    if (rows < minSize || rows > maxSize) err('size.rows', `must be ${minSize}-${maxSize}`)
  }
  const tiles: string[] = []
  if (!Array.isArray(o.tiles)) err('tiles', 'must be an array of strings (one per row)')
  else {
    if (cols && o.tiles.length !== rows) err('tiles', `has ${o.tiles.length} rows but size.rows is ${rows}`)
    o.tiles.forEach((row: unknown, r: number) => {
      if (typeof row !== 'string') return err(`tiles[${r}]`, 'must be a string')
      if (cols && row.length !== cols) err(`tiles[${r}]`, `has ${row.length} characters but size.cols is ${cols}`)
      const bad = new Set<string>()
      for (let c = 0; c < row.length; c++) {
        const ch = row[c]!
        if (!tileByChar(ch) && !bad.has(ch)) {
          bad.add(ch)
          err(`tiles[${r}][${c}]`, `unknown tile character ${JSON.stringify(ch)} (see the legend in assets/tiles.ts)`)
        }
      }
      tiles.push(row)
    })
  }

  // ---- spawn
  let spawn: [number, number] = [0, 0]
  if (!Array.isArray(o.spawn) || o.spawn.length !== 2 || !isInt(o.spawn[0]) || !isInt(o.spawn[1])) err('spawn', 'must be [col, row]')
  else spawn = [o.spawn[0], o.spawn[1]]

  // ---- props
  const props: MapFileProp[] = []
  if (!Array.isArray(o.props)) err('props', 'must be an array')
  else {
    if (o.props.length > MAP_LIMITS.maxProps) err('props', `at most ${MAP_LIMITS.maxProps}`)
    o.props.forEach((p: unknown, i: number) => {
      const at = `props[${i}]`
      if (!isObj(p)) return err(at, 'must be an object')
      const def = typeof p.type === 'string' ? propDef(p.type) : undefined
      if (!def || def.hidden) return err(`${at}.type`, `unknown prop type ${JSON.stringify(p.type)}`)
      if (!isInt(p.col) || !isInt(p.row)) return err(at, 'col and row must be integers')
      const out: MapFileProp = { type: def.type, col: p.col, row: p.row }
      for (const dim of ['w', 'h'] as const) {
        const v = p[dim]
        if (v === undefined) continue
        const min = (dim === 'w' ? def.minW : def.minH) ?? 1
        if (!isInt(v) || v < min || v > 40) err(`${at}.${dim}`, `must be an integer ${min}-40`)
        else {
          const resizable = def.resize === 'wh' || (def.resize === 'w' && dim === 'w')
          if (!resizable && v !== (dim === 'w' ? def.w : def.h)) err(`${at}.${dim}`, `${def.type} cannot be resized (fixed ${def.w}x${def.h})`)
          else out[dim] = v
        }
      }
      if (p.solid !== undefined) {
        if (typeof p.solid !== 'boolean') err(`${at}.solid`, 'must be true or false')
        else out.solid = p.solid
      }
      if (p.variant !== undefined) {
        if (!def.variants?.includes(p.variant as string)) err(`${at}.variant`, def.variants ? `must be one of ${def.variants.join(', ')}` : `${def.type} has no variants`)
        else out.variant = p.variant as string
      }
      if (p.color !== undefined) {
        if (!def.color) err(`${at}.color`, `${def.type} cannot be tinted`)
        else if (typeof p.color !== 'string' || !COLOR_REGEX.test(p.color)) err(`${at}.color`, 'must look like #rrggbb')
        else out.color = p.color
      }
      for (const k of Object.keys(p)) if (!['type', 'col', 'row', 'w', 'h', 'solid', 'variant', 'color'].includes(k)) warn(`${at}.${k}`, 'unknown field (ignored)')
      props.push(out)
    })
  }

  // ---- seats
  const seats: MapFileSeat[] = []
  if (!Array.isArray(o.seats)) err('seats', 'must be an array')
  else {
    if (o.seats.length > MAP_LIMITS.maxSeats) err('seats', `at most ${MAP_LIMITS.maxSeats}`)
    o.seats.forEach((s: unknown, i: number) => {
      const at = `seats[${i}]`
      if (!isObj(s)) return err(at, 'must be an object')
      if (!isInt(s.col) || !isInt(s.row)) return err(at, 'col and row must be integers')
      if (!DIRS.includes(s.dir as Dir)) return err(`${at}.dir`, `must be one of ${DIRS.join(', ')}`)
      if (!(SEAT_STYLES as readonly string[]).includes(s.style as string)) return err(`${at}.style`, `must be one of ${SEAT_STYLES.join(', ')}`)
      const out: MapFileSeat = { col: s.col, row: s.row, dir: s.dir as Dir, style: s.style as string }
      if (s.color !== undefined) {
        if (typeof s.color !== 'string' || !COLOR_REGEX.test(s.color)) err(`${at}.color`, 'must look like #rrggbb')
        else out.color = s.color
      }
      seats.push(out)
    })
  }

  // ---- zones
  const zones: MapFileZone[] = []
  if (!Array.isArray(o.zones)) err('zones', 'must be an array')
  else {
    if (o.zones.length > MAP_LIMITS.maxZones) err('zones', `at most ${MAP_LIMITS.maxZones}`)
    const ids = new Set<string>()
    o.zones.forEach((z: unknown, i: number) => {
      const at = `zones[${i}]`
      if (!isObj(z)) return err(at, 'must be an object')
      const id = typeof z.id === 'string' ? z.id : ''
      if (!ID_REGEX.test(id)) return err(`${at}.id`, 'must match ^[a-z0-9][a-z0-9_-]{0,31}$')
      if (ids.has(id)) return err(`${at}.id`, `duplicate zone id "${id}"`)
      ids.add(id)
      const name = typeof z.name === 'string' ? z.name.trim() : ''
      if (name.length < 1 || name.length > 40) return err(`${at}.name`, 'must be 1-40 characters')
      const r = z.rect
      if (!Array.isArray(r) || r.length !== 4 || !r.every(isInt)) return err(`${at}.rect`, 'must be [col1, row1, col2, row2] integers')
      const [c1, r1, c2, r2] = r as number[]
      if (c1! > c2! || r1! > r2!) return err(`${at}.rect`, 'must satisfy col1<=col2 and row1<=row2')
      if (cols && (c1! < 0 || r1! < 0 || c2! >= cols || r2! >= rows)) return err(`${at}.rect`, `outside the ${cols}x${rows} map`)
      zones.push({ id, name, rect: [c1!, r1!, c2!, r2!] })
    })
  }

  if (issues.some((i) => i.level === 'error')) return { map: null, issues }
  const map: MapFile = { format: MAP_FORMAT_VERSION, key, title, size: { cols, rows }, spawn, tiles, props, seats, zones }
  if (description !== undefined) map.description = description
  return { map, issues }
}

/** MapFile -> what the game runs on. Assumes a file that passed parseMapFile. */
export function buildWorldMap(file: MapFile): WorldMap {
  const { cols, rows } = file.size
  const grid = file.tiles.map((row) => Array.from(row, (ch) => (tileByChar(ch) ?? DEFAULT_TILE).id))

  const props: Prop[] = file.props.map((p) => {
    const def = propDef(p.type)!
    const out: Prop = { type: p.type, col: p.col, row: p.row, w: p.w ?? def.w, h: p.h ?? def.h, solid: p.solid ?? def.solid }
    if (p.variant ?? def.variants?.[0]) out.variant = p.variant ?? def.variants![0]
    if (p.color ?? def.color) out.color = p.color ?? def.color
    return out
  })
  const seats: Seat[] = file.seats.map((s, i) => ({
    id: `seat-${i}`,
    col: s.col,
    row: s.row,
    dir: s.dir,
    style: s.style,
    color: s.color ?? DEFAULT_SEAT_COLOR,
  }))
  // seats are also drawn as (walk-through) props so they take part in depth sorting
  for (const seat of seats) props.push({ type: 'seat', col: seat.col, row: seat.row, w: 1, h: 1, solid: false, seat })

  const map: WorldMap = {
    key: file.key,
    title: file.title,
    cols,
    rows,
    grid,
    props,
    seats,
    zones: file.zones.map((z) => ({ id: z.id, name: z.name, rect: { c1: z.rect[0], r1: z.rect[1], c2: z.rect[2], r2: z.rect[3] } })),
    spawn: { col: file.spawn[0], row: file.spawn[1] },
  }
  if (file.description) map.description = file.description
  return map
}

/**
 * Canonical text form: stable key order, one tile row / prop / seat / zone per line, so
 * git diffs show exactly what changed and the grid is readable as a picture.
 */
export function serializeMapFile(f: MapFile): string {
  const line = (v: unknown) => JSON.stringify(v)
  const list = (items: unknown[]) => (items.length ? `[\n${items.map((i) => `    ${line(i)}`).join(',\n')}\n  ]` : '[]')
  const parts = [
    `  "format": ${f.format}`,
    `  "key": ${line(f.key)}`,
    `  "title": ${line(f.title)}`,
    ...(f.description !== undefined ? [`  "description": ${line(f.description)}`] : []),
    `  "size": ${line(f.size)}`,
    `  "spawn": ${line(f.spawn)}`,
    `  "tiles": ${list(f.tiles)}`,
    `  "props": ${list(f.props)}`,
    `  "seats": ${list(f.seats)}`,
    `  "zones": ${list(f.zones)}`,
  ]
  return `{\n${parts.join(',\n')}\n}\n`
}

export function emptyMapFile(key: string, title: string, cols: number, rows: number, fillChar = DEFAULT_TILE.char): MapFile {
  return {
    format: MAP_FORMAT_VERSION,
    key,
    title,
    size: { cols, rows },
    spawn: [Math.floor(cols / 2), Math.floor(rows / 2)],
    tiles: Array.from({ length: rows }, () => fillChar.repeat(cols)),
    props: [],
    seats: [],
    zones: [],
  }
}
