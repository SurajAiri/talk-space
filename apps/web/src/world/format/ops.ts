/**
 * Pure, immutable edit operations on a MapFile. The GUI editor, the CLI (`apply`) and AI
 * edit scripts all go through these, so there is exactly one implementation of "paint a
 * rectangle" or "resize the map".
 */
import { propDef } from '../assets/props.ts'
import { DEFAULT_TILE, TILESET, tileByChar } from '../assets/tiles.ts'
import type { Issue, MapFile, MapFileProp, MapFileSeat, MapFileZone } from './mapFile.ts'

export type Cell = [number, number]
export type RectArg = [number, number, number, number]

const inside = (f: MapFile, c: number, r: number) => c >= 0 && r >= 0 && c < f.size.cols && r < f.size.rows
const norm = (r: RectArg): RectArg => [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])]

/** Accepts a tile character ("#") or a name ("wall", "Café floor", "cafe_floor"). Returns the character. */
export function resolveTile(x: unknown): string | null {
  if (typeof x !== 'string' || x === '') return null
  if (x.length === 1 && tileByChar(x)) return x
  const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '')
  const want = slug(x)
  return TILESET.find((t) => slug(t.name) === want)?.char ?? null
}

export function getTile(f: MapFile, col: number, row: number): string | null {
  return inside(f, col, row) ? f.tiles[row]![col]! : null
}

/** Set many cells at once (out-of-bounds cells are skipped). Returns the same object if nothing changed. */
export function setTiles(f: MapFile, cells: Iterable<Cell>, ch: string): MapFile {
  const rows = new Map<number, string[]>()
  let changed = false
  for (const [c, r] of cells) {
    if (!inside(f, c, r)) continue
    let arr = rows.get(r)
    if (!arr) rows.set(r, (arr = Array.from(f.tiles[r]!)))
    if (arr[c] !== ch) {
      arr[c] = ch
      changed = true
    }
  }
  if (!changed) return f
  const tiles = f.tiles.slice()
  for (const [r, arr] of rows) tiles[r] = arr.join('')
  return { ...f, tiles }
}

export function rectCells(r: RectArg): Cell[] {
  const [c1, r1, c2, r2] = norm(r)
  const out: Cell[] = []
  for (let row = r1; row <= r2; row++) for (let col = c1; col <= c2; col++) out.push([col, row])
  return out
}
export const fillRect = (f: MapFile, r: RectArg, ch: string) => setTiles(f, rectCells(r), ch)
export function strokeRect(f: MapFile, r: RectArg, ch: string): MapFile {
  const [c1, r1, c2, r2] = norm(r)
  return setTiles(f, rectCells([c1, r1, c2, r2]).filter(([c, row]) => c === c1 || c === c2 || row === r1 || row === r2), ch)
}
/** Cells of the same-tile region containing (col,row), 4-way. */
export function regionCells(f: MapFile, col: number, row: number): Cell[] {
  const from = getTile(f, col, row)
  if (from === null) return []
  const seen = new Set<number>([row * f.size.cols + col])
  const out: Cell[] = []
  const stack: Cell[] = [[col, row]]
  while (stack.length) {
    const [c, r] = stack.pop()!
    out.push([c, r])
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc
      const nr = r + dr
      if (getTile(f, nc, nr) !== from || seen.has(nr * f.size.cols + nc)) continue
      seen.add(nr * f.size.cols + nc)
      stack.push([nc, nr])
    }
  }
  return out
}
export const floodFill = (f: MapFile, col: number, row: number, ch: string) => setTiles(f, regionCells(f, col, row), ch)

// ---------- props / seats / zones (index based: they are small ordered lists) ----------

/** Drop fields that equal the catalog default, so files stay short and diffs stay small. */
export function compactProp(p: MapFileProp): MapFileProp {
  const d = propDef(p.type)
  const out: MapFileProp = { type: p.type, col: p.col, row: p.row }
  if (!d) return { ...p }
  if (p.w !== undefined && p.w !== d.w) out.w = p.w
  if (p.h !== undefined && p.h !== d.h) out.h = p.h
  if (p.solid !== undefined && p.solid !== d.solid) out.solid = p.solid
  const variant = p.variant ?? d.variants?.[0]
  if (variant !== undefined) out.variant = variant
  if (p.color !== undefined && p.color !== d.color) out.color = p.color
  return out
}
export const addProp = (f: MapFile, p: MapFileProp): MapFile => ({ ...f, props: [...f.props, compactProp(p)] })
export const updateProp = (f: MapFile, i: number, patch: Partial<MapFileProp>): MapFile =>
  f.props[i] ? { ...f, props: f.props.map((p, k) => (k === i ? compactProp({ ...p, ...patch }) : p)) } : f
export const removeProp = (f: MapFile, i: number): MapFile => ({ ...f, props: f.props.filter((_, k) => k !== i) })

export const addSeat = (f: MapFile, s: MapFileSeat): MapFile => ({ ...f, seats: [...f.seats, s] })
export const updateSeat = (f: MapFile, i: number, patch: Partial<MapFileSeat>): MapFile =>
  f.seats[i] ? { ...f, seats: f.seats.map((s, k) => (k === i ? { ...s, ...patch } : s)) } : f
export const removeSeat = (f: MapFile, i: number): MapFile => ({ ...f, seats: f.seats.filter((_, k) => k !== i) })

export const addZone = (f: MapFile, z: MapFileZone): MapFile => ({ ...f, zones: [...f.zones, { ...z, rect: norm(z.rect) }] })
export const updateZone = (f: MapFile, i: number, patch: Partial<MapFileZone>): MapFile =>
  f.zones[i] ? { ...f, zones: f.zones.map((z, k) => (k === i ? { ...z, ...patch, rect: norm(patch.rect ?? z.rect) } : z)) } : f
export const removeZone = (f: MapFile, i: number): MapFile => ({ ...f, zones: f.zones.filter((_, k) => k !== i) })

/** A zone id not used yet: "area-1", "area-2", ... */
export function freshZoneId(f: MapFile): string {
  const used = new Set(f.zones.map((z) => z.id))
  for (let n = 1; ; n++) if (!used.has(`area-${n}`)) return `area-${n}`
}

export const setSpawn = (f: MapFile, col: number, row: number): MapFile => ({ ...f, spawn: [col, row] })
export const setMeta = (f: MapFile, m: { title?: string; description?: string }): MapFile => {
  const out = { ...f, ...(m.title !== undefined ? { title: m.title } : {}) }
  if (m.description !== undefined) {
    if (m.description === '') delete out.description
    else out.description = m.description
  }
  return out
}

/**
 * Change the map size, anchored at the top-left. New area is filled with `fillChar`;
 * props/seats outside are removed, zones are clipped (or removed if fully outside).
 */
export function resizeMap(f: MapFile, cols: number, rows: number, fillChar = DEFAULT_TILE.char): MapFile {
  const tiles = Array.from({ length: rows }, (_, r) => {
    const old = f.tiles[r] ?? ''
    return old.length >= cols ? old.slice(0, cols) : old + fillChar.repeat(cols - old.length)
  })
  const zones: MapFileZone[] = []
  for (const z of f.zones) {
    const [c1, r1, c2, r2] = z.rect
    if (c1 >= cols || r1 >= rows) continue
    zones.push({ ...z, rect: [c1, r1, Math.min(c2, cols - 1), Math.min(r2, rows - 1)] })
  }
  const keep = (c: number, r: number) => c < cols && r < rows
  return {
    ...f,
    size: { cols, rows },
    tiles,
    props: f.props.filter((p) => keep(p.col, p.row)),
    seats: f.seats.filter((s) => keep(s.col, s.row)),
    zones,
    spawn: [Math.min(f.spawn[0], cols - 1), Math.min(f.spawn[1], rows - 1)],
  }
}

// ---------- JSON op scripts (the AI-friendly interface) ----------

type Obj = Record<string, unknown>
const withoutOp = (o: Obj): Obj => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'op'))
const isCell = (v: unknown): v is Cell => Array.isArray(v) && v.length === 2 && v.every(Number.isInteger)
const isRect = (v: unknown): v is RectArg => Array.isArray(v) && v.length === 4 && v.every(Number.isInteger)

/** Is the (col,row) origin of this prop/seat inside the rectangle? */
const within = (r: RectArg, col: number, row: number) => {
  const [c1, r1, c2, r2] = norm(r)
  return col >= c1 && col <= c2 && row >= r1 && row <= r2
}

/**
 * Apply a list of JSON operations in order. Never throws; every invalid op is reported
 * as an issue with its index and skipped. Callers decide whether to keep a partial result
 * (the CLI refuses to write unless there are zero errors).
 *
 *  fillRect    {tile, rect}            strokeRect {tile, rect}
 *  setTiles    {tile, cells:[[c,r]..]} floodFill  {tile, at:[c,r]}
 *  addProp     {type, col, row, w?, h?, solid?, variant?}
 *  removeProps {rect}                  (removes props whose top-left corner is inside)
 *  addSeat     {col, row, dir, style, color?}   removeSeats {rect}
 *  addZone     {id, name, rect}        removeZone {id}
 *  setSpawn    {at:[c,r]}              setMeta {title?, description?}
 *  resize      {cols, rows, fill?}
 */
export function applyOps(start: MapFile, ops: unknown): { map: MapFile; issues: Issue[] } {
  const issues: Issue[] = []
  let f = start
  if (!Array.isArray(ops)) return { map: f, issues: [{ level: 'error', path: 'ops', message: 'must be an array of operations' }] }

  ops.forEach((raw: unknown, i: number) => {
    const at = `ops[${i}]`
    const bad = (m: string) => issues.push({ level: 'error', path: at, message: m })
    if (typeof raw !== 'object' || raw === null) return bad('must be an object')
    const o = raw as Obj
    const tile = () => {
      const ch = resolveTile(o.tile)
      if (!ch) bad(`unknown tile ${JSON.stringify(o.tile)}; use a character or a name like "wall"`)
      return ch
    }
    switch (o.op) {
      case 'fillRect':
      case 'strokeRect': {
        const ch = tile()
        if (!isRect(o.rect)) return bad('rect must be [col1,row1,col2,row2]')
        if (ch) f = (o.op === 'fillRect' ? fillRect : strokeRect)(f, o.rect, ch)
        return
      }
      case 'setTiles': {
        const ch = tile()
        if (!Array.isArray(o.cells) || !o.cells.every(isCell)) return bad('cells must be [[col,row],...]')
        if (ch) f = setTiles(f, o.cells as Cell[], ch)
        return
      }
      case 'floodFill': {
        const ch = tile()
        if (!isCell(o.at)) return bad('at must be [col,row]')
        if (ch) f = floodFill(f, o.at[0], o.at[1], ch)
        return
      }
      case 'addProp': {
        if (typeof o.type !== 'string' || !Number.isInteger(o.col) || !Number.isInteger(o.row)) return bad('needs type, col, row')
        f = addProp(f, withoutOp(o) as unknown as MapFileProp)
        return
      }
      case 'removeProps':
        if (!isRect(o.rect)) return bad('rect must be [col1,row1,col2,row2]')
        f = { ...f, props: f.props.filter((p) => !within(o.rect as RectArg, p.col, p.row)) }
        return
      case 'addSeat': {
        if (!Number.isInteger(o.col) || !Number.isInteger(o.row)) return bad('needs col, row')
        f = addSeat(f, withoutOp(o) as unknown as MapFileSeat)
        return
      }
      case 'removeSeats':
        if (!isRect(o.rect)) return bad('rect must be [col1,row1,col2,row2]')
        f = { ...f, seats: f.seats.filter((s) => !within(o.rect as RectArg, s.col, s.row)) }
        return
      case 'addZone':
        if (typeof o.id !== 'string' || typeof o.name !== 'string' || !isRect(o.rect)) return bad('needs id, name, rect')
        f = addZone(f, { id: o.id, name: o.name, rect: o.rect })
        return
      case 'removeZone': {
        const idx = f.zones.findIndex((z) => z.id === o.id)
        if (idx < 0) return bad(`no zone with id ${JSON.stringify(o.id)}`)
        f = removeZone(f, idx)
        return
      }
      case 'setSpawn':
        if (!isCell(o.at)) return bad('at must be [col,row]')
        f = setSpawn(f, o.at[0], o.at[1])
        return
      case 'setMeta':
        f = setMeta(f, { title: typeof o.title === 'string' ? o.title : undefined, description: typeof o.description === 'string' ? o.description : undefined })
        return
      case 'resize': {
        if (!Number.isInteger(o.cols) || !Number.isInteger(o.rows)) return bad('needs integer cols and rows')
        const fill = o.fill === undefined ? DEFAULT_TILE.char : resolveTile(o.fill)
        if (!fill) return bad(`unknown fill tile ${JSON.stringify(o.fill)}`)
        f = resizeMap(f, o.cols as number, o.rows as number, fill)
        return
      }
      default:
        bad(`unknown op ${JSON.stringify(o.op)}`)
    }
  })
  return { map: f, issues }
}
