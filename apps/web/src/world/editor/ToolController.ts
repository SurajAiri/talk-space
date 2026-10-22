/**
 * What every tool does on pointer down / move / up. Input is in TILE coordinates (floats),
 * so this class has no DOM dependency: the canvas view only translates mouse events.
 */
import { propDef } from '../assets/props.ts'
import type { MapFile } from '../format/mapFile.ts'
import {
  addProp, addSeat, addZone, fillRect, floodFill, freshZoneId, getTile, removeProp, removeSeat, removeZone,
  setSpawn, setTiles, strokeRect, type Cell, type RectArg,
} from '../format/ops.ts'
import type { EditorModel, Selection } from './EditorModel.ts'

export interface Point {
  x: number
  y: number
}

/** What the view should draw on top of the map while a tool is active. */
export interface Preview {
  hover: Cell | null
  /** cells the next paint would touch */
  brush: Cell[]
  /** rubber-band rectangle (rect/outline/zone/resizable prop) */
  rect: RectArg | null
  /** a translucent prop under the cursor */
  ghost: { type: string; col: number; row: number; w: number; h: number; variant?: string } | null
}

type Drag =
  | { kind: 'paint'; last: Cell }
  | { kind: 'erase'; last: Cell }
  | { kind: 'rect'; start: Cell; end: Cell }
  | { kind: 'move'; origin: Cell; base: MapFile; sel: NonNullable<Selection> }
  | { kind: 'resize-zone'; index: number; corner: 0 | 1 | 2 | 3; base: MapFile }

const cellOf = (p: Point): Cell => [Math.floor(p.x), Math.floor(p.y)]
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export class ToolController {
  private drag: Drag | null = null
  private hoverCell: Cell | null = null
  private readonly model: EditorModel

  constructor(model: EditorModel) {
    this.model = model
  }

  private get map() {
    return this.model.current
  }
  private clampCell(c: Cell): Cell {
    return [clampN(c[0], 0, this.map.size.cols - 1), clampN(c[1], 0, this.map.size.rows - 1)]
  }

  // ---------- pointer events ----------
  down(p: Point) {
    const s = this.model.getSnapshot()
    const cell = cellOf(p)
    this.hoverCell = cell

    switch (s.tool) {
      case 'paint':
        this.model.beginStroke()
        this.paintAt(cell)
        this.drag = { kind: 'paint', last: cell }
        break
      case 'rect':
      case 'outline':
      case 'zone':
        this.drag = { kind: 'rect', start: this.clampCell(cell), end: this.clampCell(cell) }
        break
      case 'prop': {
        const def = propDef(s.propType)
        if (!def) return
        if (def.resize === 'none') this.placeProp(this.clampCell(cell), cell, cell)
        else this.drag = { kind: 'rect', start: this.clampCell(cell), end: this.clampCell(cell) }
        break
      }
      case 'fill': {
        const ch = s.tile
        this.model.commit(floodFill(this.map, cell[0], cell[1], ch))
        break
      }
      case 'pick': {
        const ch = getTile(this.map, cell[0], cell[1])
        if (ch) this.model.set({ tile: ch, tool: 'paint' })
        break
      }
      case 'seat':
        if (this.inside(cell)) {
          this.model.commit(addSeat(this.map, { col: cell[0], row: cell[1], dir: s.seatDir, style: s.seatStyle, color: s.seatColor }))
          this.model.select({ kind: 'seat', index: this.map.seats.length - 1 })
        }
        break
      case 'spawn':
        if (this.inside(cell)) this.model.commit(setSpawn(this.map, cell[0], cell[1]))
        break
      case 'erase':
        this.model.beginStroke()
        this.eraseAt(cell)
        this.drag = { kind: 'erase', last: cell }
        break
      case 'select':
        this.selectDown(p, cell)
        break
    }
  }

  move(p: Point) {
    const cell = cellOf(p)
    this.hoverCell = cell
    const d = this.drag
    if (!d) return
    switch (d.kind) {
      case 'paint':
        for (const c of line(d.last, cell)) this.paintAt(c)
        d.last = cell
        break
      case 'erase':
        for (const c of line(d.last, cell)) this.eraseAt(c)
        d.last = cell
        break
      case 'rect':
        d.end = this.clampCell(cell)
        break
      case 'move':
        this.model.updateStroke(this.moved(d.base, d.sel, cell[0] - d.origin[0], cell[1] - d.origin[1]))
        break
      case 'resize-zone': {
        const z = d.base.zones[d.index]!
        const [c1, r1, c2, r2] = z.rect
        const cx = clampN(Math.round(p.x), 0, d.base.size.cols)
        const cy = clampN(Math.round(p.y), 0, d.base.size.rows)
        // corner points sit on tile edges: corner 0=TL 1=TR 2=BL 3=BR; the dragged edge is exclusive-end
        const nc1 = d.corner === 0 || d.corner === 2 ? Math.min(cx, c2) : c1
        const nc2 = d.corner === 1 || d.corner === 3 ? Math.max(cx - 1, c1) : c2
        const nr1 = d.corner === 0 || d.corner === 1 ? Math.min(cy, r2) : r1
        const nr2 = d.corner === 2 || d.corner === 3 ? Math.max(cy - 1, r1) : r2
        this.model.updateStroke({ ...d.base, zones: d.base.zones.map((zz, i) => (i === d.index ? { ...zz, rect: [nc1, nr1, nc2, nr2] } : zz)) })
        break
      }
    }
  }

  up(p: Point) {
    const d = this.drag
    this.drag = null
    if (!d) return
    const s = this.model.getSnapshot()
    switch (d.kind) {
      case 'paint':
      case 'erase':
      case 'move':
      case 'resize-zone':
        this.model.endStroke()
        break
      case 'rect': {
        const end = this.clampCell(cellOf(p))
        const r: RectArg = [d.start[0], d.start[1], end[0], end[1]]
        if (s.tool === 'rect') this.model.commit(fillRect(this.map, r, s.tile))
        else if (s.tool === 'outline') this.model.commit(strokeRect(this.map, r, s.tile))
        else if (s.tool === 'zone') {
          const rect: RectArg = [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])]
          const id = freshZoneId(this.map)
          this.model.commit(addZone(this.map, { id, name: `Area ${this.map.zones.length + 1}`, rect }))
          this.model.select({ kind: 'zone', index: this.map.zones.length - 1 })
        } else if (s.tool === 'prop') this.placeProp(d.start, d.start, end)
        break
      }
    }
  }

  hover(p: Point | null) {
    this.hoverCell = p ? cellOf(p) : null
  }
  /** Esc: abandon the current drag without applying it. */
  cancel() {
    if (this.drag) {
      this.drag = null
      this.model.cancelStroke()
    }
  }

  // ---------- keyboard actions ----------
  deleteSelection() {
    const sel = this.model.getSnapshot().selection
    if (!sel || sel.kind === 'spawn') return
    const m = this.map
    const next = sel.kind === 'prop' ? removeProp(m, sel.index) : sel.kind === 'seat' ? removeSeat(m, sel.index) : removeZone(m, sel.index)
    this.model.select(null)
    this.model.commit(next)
  }
  nudge(dc: number, dr: number) {
    const sel = this.model.getSnapshot().selection
    if (sel) this.model.commit(this.moved(this.map, sel, dc, dr))
  }

  // ---------- preview for the view ----------
  preview(): Preview {
    const s = this.model.getSnapshot()
    const hover = this.hoverCell
    const out: Preview = { hover, brush: [], rect: null, ghost: null }
    if (this.drag?.kind === 'rect') {
      const { start, end } = this.drag
      out.rect = [Math.min(start[0], end[0]), Math.min(start[1], end[1]), Math.max(start[0], end[0]), Math.max(start[1], end[1])]
    }
    if (!hover) return out
    if (s.tool === 'paint') out.brush = this.brushCells(hover)
    if (s.tool === 'prop' && !this.drag) {
      const def = propDef(s.propType)
      if (def) out.ghost = { type: def.type, col: hover[0], row: hover[1], w: def.w, h: def.h, variant: s.propVariant }
    }
    if (s.tool === 'prop' && this.drag?.kind === 'rect' && out.rect) {
      const def = propDef(s.propType)!
      const [c1, r1, c2, r2] = out.rect
      const w = def.resize === 'none' ? def.w : Math.max(def.minW ?? 1, c2 - c1 + 1)
      const h = def.resize === 'wh' ? Math.max(def.minH ?? 1, r2 - r1 + 1) : def.h
      out.ghost = { type: def.type, col: c1, row: this.drag.start[1], w, h, variant: s.propVariant }
      out.rect = null
    }
    return out
  }

  // ---------- internals ----------
  private inside(c: Cell) {
    return c[0] >= 0 && c[1] >= 0 && c[0] < this.map.size.cols && c[1] < this.map.size.rows
  }
  private brushCells(c: Cell): Cell[] {
    const n = this.model.getSnapshot().brush
    const off = Math.floor((n - 1) / 2)
    const out: Cell[] = []
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) out.push([c[0] - off + k, c[1] - off + r])
    return out
  }
  private paintAt(c: Cell) {
    this.model.updateStroke(setTiles(this.map, this.brushCells(c), this.model.getSnapshot().tile))
  }

  /** Remove the top-most seat, else prop, whose footprint contains the cell. */
  private eraseAt(c: Cell) {
    const m = this.map
    const si = m.seats.findLastIndex((s) => s.col === c[0] && s.row === c[1])
    if (si >= 0) return this.model.updateStroke(removeSeat(m, si))
    const pi = m.props.findLastIndex((p) => this.covers(p, c))
    if (pi >= 0) this.model.updateStroke(removeProp(m, pi))
  }
  private covers(p: MapFile['props'][number], c: Cell) {
    const d = propDef(p.type)!
    const w = p.w ?? d.w
    const h = p.h ?? d.h
    return c[0] >= p.col && c[0] < p.col + w && c[1] >= p.row && c[1] < p.row + h
  }

  /** Place the selected prop type. `anchor` = drag start; `a`/`b` = drag corners (equal for a click). */
  private placeProp(anchor: Cell, a: Cell, b: Cell) {
    const s = this.model.getSnapshot()
    const def = propDef(s.propType)
    if (!def) return
    const clicked = a[0] === b[0] && a[1] === b[1]
    const c1 = Math.min(a[0], b[0])
    const r1 = Math.min(a[1], b[1])
    let w = def.w
    let h = def.h
    let col = anchor[0]
    let row = anchor[1]
    if (!clicked) {
      if (def.resize !== 'none') {
        w = Math.max(def.minW ?? 1, Math.abs(a[0] - b[0]) + 1)
        col = c1
      }
      if (def.resize === 'wh') {
        h = Math.max(def.minH ?? 1, Math.abs(a[1] - b[1]) + 1)
        row = r1
      }
    }
    const { cols, rows } = this.map.size
    col = clampN(col, 0, Math.max(0, cols - w))
    row = clampN(row, 0, Math.max(0, rows - h))
    if (w > cols || h > rows) return
    this.model.commit(addProp(this.map, { type: def.type, col, row, ...(w !== def.w ? { w } : {}), ...(h !== def.h ? { h } : {}), ...(s.propVariant ? { variant: s.propVariant } : {}) }))
    this.model.select({ kind: 'prop', index: this.map.props.length - 1 })
  }

  private selectDown(p: Point, cell: Cell) {
    const m = this.map
    const sel = this.model.getSnapshot().selection

    // 1. corner handles of the selected zone
    if (sel?.kind === 'zone') {
      const [c1, r1, c2, r2] = m.zones[sel.index]!.rect
      const corners: [number, number][] = [[c1, r1], [c2 + 1, r1], [c1, r2 + 1], [c2 + 1, r2 + 1]]
      const hit = corners.findIndex(([x, y]) => Math.hypot(p.x - x, p.y - y) < 0.6)
      if (hit >= 0) {
        this.model.beginStroke()
        this.drag = { kind: 'resize-zone', index: sel.index, corner: hit as 0 | 1 | 2 | 3, base: m }
        return
      }
    }
    // 2. things, smallest/top-most first: seat > prop > spawn > zone
    let hit: Selection = null
    const si = m.seats.findLastIndex((s) => s.col === cell[0] && s.row === cell[1])
    if (si >= 0) hit = { kind: 'seat', index: si }
    else {
      const pi = m.props.findLastIndex((pp) => this.covers(pp, cell))
      if (pi >= 0) hit = { kind: 'prop', index: pi }
      else if (m.spawn[0] === cell[0] && m.spawn[1] === cell[1]) hit = { kind: 'spawn' }
      else {
        let best = -1
        let bestArea = Infinity
        m.zones.forEach((z, i) => {
          const [c1, r1, c2, r2] = z.rect
          if (cell[0] >= c1 && cell[0] <= c2 && cell[1] >= r1 && cell[1] <= r2) {
            const area = (c2 - c1 + 1) * (r2 - r1 + 1)
            if (area <= bestArea) {
              best = i
              bestArea = area
            }
          }
        })
        if (best >= 0) hit = { kind: 'zone', index: best }
      }
    }
    this.model.select(hit)
    if (hit) {
      this.model.beginStroke()
      this.drag = { kind: 'move', origin: cell, base: m, sel: hit }
    }
  }

  /** `base` with the selected thing shifted by (dc, dr), kept inside the map. */
  private moved(base: MapFile, sel: NonNullable<Selection>, dc: number, dr: number): MapFile {
    const { cols, rows } = base.size
    if (sel.kind === 'spawn') return setSpawn(base, clampN(base.spawn[0] + dc, 0, cols - 1), clampN(base.spawn[1] + dr, 0, rows - 1))
    if (sel.kind === 'seat') {
      const s = base.seats[sel.index]
      return s ? { ...base, seats: base.seats.map((x, i) => (i === sel.index ? { ...x, col: clampN(s.col + dc, 0, cols - 1), row: clampN(s.row + dr, 0, rows - 1) } : x)) } : base
    }
    if (sel.kind === 'prop') {
      const p = base.props[sel.index]
      if (!p) return base
      const d = propDef(p.type)!
      const w = p.w ?? d.w
      const h = p.h ?? d.h
      return { ...base, props: base.props.map((x, i) => (i === sel.index ? { ...x, col: clampN(p.col + dc, 0, cols - w), row: clampN(p.row + dr, 0, rows - h) } : x)) }
    }
    const z = base.zones[sel.index]
    if (!z) return base
    const [c1, r1, c2, r2] = z.rect
    const w = c2 - c1
    const h = r2 - r1
    const nc = clampN(c1 + dc, 0, cols - 1 - w)
    const nr = clampN(r1 + dr, 0, rows - 1 - h)
    return { ...base, zones: base.zones.map((x, i) => (i === sel.index ? { ...x, rect: [nc, nr, nc + w, nr + h] } : x)) }
  }
}

/** Every cell on the straight line a -> b (Bresenham), so fast drags leave no gaps. */
function line(a: Cell, b: Cell): Cell[] {
  const out: Cell[] = []
  let [x, y] = a
  const dx = Math.abs(b[0] - x)
  const dy = -Math.abs(b[1] - y)
  const sx = x < b[0] ? 1 : -1
  const sy = y < b[1] ? 1 : -1
  let err = dx + dy
  for (;;) {
    out.push([x, y])
    if (x === b[0] && y === b[1]) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
  return out
}
