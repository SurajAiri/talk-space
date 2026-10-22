/**
 * All map-editor state, with no DOM and no React: edit history, current tool and its
 * settings, selection. The canvas view and the React panels are thin layers over this, and
 * every real edit goes through format/ops.ts (the same code the CLI uses).
 */
import { propDef } from '../assets/props.ts'
import { DEFAULT_TILE } from '../assets/tiles.ts'
import { buildWorldMap, type Issue, type MapFile } from '../format/mapFile.ts'
import { validateMap } from '../format/validate.ts'
import type { WorldMap, Dir } from '../types.ts'

export type ToolId = 'select' | 'paint' | 'rect' | 'outline' | 'fill' | 'pick' | 'prop' | 'seat' | 'zone' | 'spawn' | 'erase'
export type Selection = { kind: 'prop' | 'seat' | 'zone'; index: number } | { kind: 'spawn' } | null

export interface ToolSettings {
  tool: ToolId
  /** tile character used by paint / rect / outline / fill */
  tile: string
  /** paint brush edge length in tiles */
  brush: number
  propType: string
  propVariant: string | undefined
  seatStyle: string
  seatDir: Dir
  seatColor: string
}

export interface EditorSnapshot extends ToolSettings {
  map: MapFile
  world: WorldMap
  /** semantic issues of the last committed state (not recomputed mid-stroke) */
  issues: Issue[]
  selection: Selection
  canUndo: boolean
  canRedo: boolean
  /** differs from what is on disk (or from the freshly loaded/created map) */
  dirty: boolean
}

const HISTORY_LIMIT = 200

export class EditorModel {
  private map: MapFile
  private saved: MapFile
  private past: MapFile[] = []
  private future: MapFile[] = []
  private stroke: { before: MapFile } | null = null
  private settings: ToolSettings
  private selection: Selection = null
  private issues: Issue[]
  private world: WorldMap
  private snap!: EditorSnapshot
  private readonly listeners = new Set<() => void>()

  constructor(initial: MapFile, savedBaseline: MapFile | null = initial) {
    this.map = initial
    this.saved = savedBaseline ?? ({} as MapFile) // null baseline = a brand-new, never-saved map (always dirty)
    this.world = buildWorldMap(initial)
    this.issues = validateMap(initial)
    this.settings = {
      tool: 'paint',
      tile: DEFAULT_TILE.char,
      brush: 1,
      propType: 'tree',
      propVariant: propDef('tree')?.variants?.[0],
      seatStyle: 'stool',
      seatDir: 'down',
      seatColor: '#6366f1',
    }
    this.rebuild()
  }

  // ---------- subscription (for useSyncExternalStore) ----------
  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
  getSnapshot = (): EditorSnapshot => this.snap

  private rebuild() {
    this.snap = {
      ...this.settings,
      map: this.map,
      world: this.world,
      issues: this.issues,
      selection: this.selection,
      canUndo: this.past.length > 0 || this.stroke !== null,
      canRedo: this.future.length > 0,
      dirty: this.map !== this.saved,
    }
  }
  private emit() {
    this.rebuild()
    for (const l of this.listeners) l()
  }

  /** Recompute derived data after the map changed. `full` also re-runs the validator. */
  private setMap(next: MapFile, full: boolean) {
    this.map = next
    this.world = buildWorldMap(next)
    if (full) this.issues = validateMap(next)
    // selection indexes can fall off the end after a delete / undo
    const s = this.selection
    if (s && s.kind !== 'spawn') {
      const list = s.kind === 'prop' ? next.props : s.kind === 'seat' ? next.seats : next.zones
      if (s.index >= list.length) this.selection = null
    }
  }

  // ---------- edits ----------
  /** One undoable edit. No-op if the op returned the same object. */
  commit(next: MapFile) {
    if (next === this.map) return
    if (this.stroke) return this.updateStroke(next) // a commit inside a stroke belongs to the stroke
    this.past.push(this.map)
    if (this.past.length > HISTORY_LIMIT) this.past.shift()
    this.future = []
    this.setMap(next, true)
    this.emit()
  }

  /** Many live updates (a paint drag) that become ONE undo step. */
  beginStroke() {
    if (!this.stroke) this.stroke = { before: this.map }
  }
  updateStroke(next: MapFile) {
    if (!this.stroke || next === this.map) return
    this.setMap(next, false) // skip the validator while dragging
    this.emit()
  }
  endStroke() {
    const s = this.stroke
    if (!s) return
    this.stroke = null
    if (this.map !== s.before) {
      this.past.push(s.before)
      if (this.past.length > HISTORY_LIMIT) this.past.shift()
      this.future = []
      this.issues = validateMap(this.map)
    }
    this.emit()
  }
  cancelStroke() {
    const s = this.stroke
    if (!s) return
    this.stroke = null
    this.setMap(s.before, true)
    this.emit()
  }
  /** Current map, including live (uncommitted) stroke changes. Tools build on this. */
  get current(): MapFile {
    return this.map
  }
  get inStroke(): boolean {
    return this.stroke !== null
  }

  undo() {
    if (this.stroke) return this.cancelStroke()
    const prev = this.past.pop()
    if (!prev) return
    this.future.push(this.map)
    this.setMap(prev, true)
    this.emit()
  }
  redo() {
    const next = this.future.pop()
    if (!next) return
    this.past.push(this.map)
    this.setMap(next, true)
    this.emit()
  }

  /** Replace everything (open / import / new). `onDisk` = the content that is saved, or null for a new map. */
  load(map: MapFile, onDisk: MapFile | null) {
    this.stroke = null
    this.past = []
    this.future = []
    this.selection = null
    this.saved = onDisk ?? ({} as MapFile)
    this.setMap(map, true)
    this.emit()
  }
  markSaved() {
    this.saved = this.map
    this.emit()
  }

  // ---------- tool settings / selection ----------
  set(patch: Partial<ToolSettings>) {
    const next = { ...this.settings, ...patch }
    // switching prop type resets the variant to that type's default
    if (patch.propType && patch.propType !== this.settings.propType) next.propVariant = propDef(patch.propType)?.variants?.[0]
    this.settings = next
    this.emit()
  }
  select(sel: Selection) {
    this.selection = sel
    this.emit()
  }
}
