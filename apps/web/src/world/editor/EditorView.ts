import { drawProp, propDef } from '../assets/props.ts'
import { isTileBlocked } from '../navigation.ts'
import { drawWorldTiles } from '../render/scene.ts'
import { TILE, type Prop } from '../types.ts'
import type { EditorModel } from './EditorModel.ts'
import type { ToolController } from './ToolController.ts'

export interface Layers {
  grid: boolean
  zones: boolean
  /** red tint on everything people cannot walk through */
  blocked: boolean
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const MIN_ZOOM = 0.15
const MAX_ZOOM = 3

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

/**
 * Draws the map being edited exactly as the game draws it (same renderers), plus editing
 * overlays, and turns mouse input into tile coordinates for the ToolController.
 * Pan: right/middle mouse or Space+drag. Zoom: wheel (around the cursor).
 */
export class EditorView {
  layers: Layers = { grid: true, zones: true, blocked: false }

  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly model: EditorModel
  private readonly tools: ToolController
  private readonly onStatus: (text: string) => void
  private readonly cleanup: (() => void)[] = []

  private cam = { x: 0, y: 0, zoom: 1 }
  private cssW = 1
  private cssH = 1
  private dpr = 1
  private raf = 0
  private panning: { sx: number; sy: number; cx: number; cy: number } | null = null
  private spaceDown = false
  private lastStatus = ''

  constructor(canvas: HTMLCanvasElement, model: EditorModel, tools: ToolController, onStatus: (text: string) => void) {
    this.canvas = canvas
    this.model = model
    this.tools = tools
    this.onStatus = onStatus
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available')
    this.ctx = ctx
  }

  start() {
    const on = (t: EventTarget, type: string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts)
      this.cleanup.push(() => t.removeEventListener(type, fn as EventListener, opts))
    }
    on(this.canvas, 'pointerdown', this.onDown)
    on(this.canvas, 'pointermove', this.onMove)
    on(this.canvas, 'pointerup', this.onUp)
    on(this.canvas, 'pointerleave', () => this.tools.hover(null))
    on(this.canvas, 'contextmenu', (e: Event) => e.preventDefault())
    on(this.canvas, 'wheel', this.onWheel, { passive: false })
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e)) {
        this.spaceDown = true
        e.preventDefault()
      }
    })
    on(window, 'keyup', (e: KeyboardEvent) => {
      if (e.code === 'Space') this.spaceDown = false
    })
    const ro = new ResizeObserver(() => this.resize())
    ro.observe(this.canvas)
    this.cleanup.push(() => ro.disconnect())
    this.resize()
    this.fit()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    for (const fn of this.cleanup.splice(0)) fn()
  }

  /** Centre the whole map in the view. */
  fit() {
    const { cols, rows } = this.model.getSnapshot().map.size
    const zoom = clamp(Math.min(this.cssW / (cols * TILE), this.cssH / (rows * TILE)) * 0.95, MIN_ZOOM, MAX_ZOOM)
    this.cam = { x: (cols * TILE) / 2, y: (rows * TILE) / 2, zoom }
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect()
    this.cssW = Math.max(1, r.width)
    this.cssH = Math.max(1, r.height)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(this.cssW * this.dpr)
    this.canvas.height = Math.round(this.cssH * this.dpr)
  }

  // ---------- input ----------
  /** screen (client px) -> tile coordinates (floats) */
  private toTile(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect()
    const wx = (e.clientX - r.left - this.cssW / 2) / this.cam.zoom + this.cam.x
    const wy = (e.clientY - r.top - this.cssH / 2) / this.cam.zoom + this.cam.y
    return { x: wx / TILE, y: wy / TILE }
  }

  private readonly onDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture?.(e.pointerId)
    if (e.button === 1 || e.button === 2 || this.spaceDown) {
      this.panning = { sx: e.clientX, sy: e.clientY, cx: this.cam.x, cy: this.cam.y }
      return
    }
    if (e.button === 0) this.tools.down(this.toTile(e))
  }

  private readonly onMove = (e: PointerEvent) => {
    if (this.panning) {
      this.cam.x = this.panning.cx - (e.clientX - this.panning.sx) / this.cam.zoom
      this.cam.y = this.panning.cy - (e.clientY - this.panning.sy) / this.cam.zoom
      return
    }
    const p = this.toTile(e)
    if (e.buttons & 1) this.tools.move(p)
    else this.tools.hover(p)
    const s = this.model.getSnapshot()
    const c = Math.floor(p.x)
    const r = Math.floor(p.y)
    const inMap = c >= 0 && r >= 0 && c < s.map.size.cols && r < s.map.size.rows
    const text = inMap ? `col ${c}, row ${r}   tile "${s.map.tiles[r]![c]}"` : ''
    if (text !== this.lastStatus) {
      this.lastStatus = text
      this.onStatus(text)
    }
  }

  private readonly onUp = (e: PointerEvent) => {
    if (this.panning) {
      this.panning = null
      return
    }
    if (e.button === 0) this.tools.up(this.toTile(e))
  }

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const before = this.toTile(e)
    this.cam.zoom = clamp(this.cam.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), MIN_ZOOM, MAX_ZOOM)
    const after = this.toTile(e) // keep the tile under the cursor fixed
    this.cam.x += (before.x - after.x) * TILE
    this.cam.y += (before.y - after.y) * TILE
  }

  // ---------- drawing ----------
  private readonly frame = (t: number) => {
    this.render(t)
    this.raf = requestAnimationFrame(this.frame)
  }

  private render(time: number) {
    const g = this.ctx
    const s = this.model.getSnapshot()
    const { world } = s
    const { zoom } = this.cam
    const mapW = world.cols * TILE
    const mapH = world.rows * TILE

    g.setTransform(1, 0, 0, 1, 0, 0)
    g.fillStyle = '#0b1020'
    g.fillRect(0, 0, this.canvas.width, this.canvas.height)
    g.setTransform(zoom * this.dpr, 0, 0, zoom * this.dpr, (this.cssW / 2 - this.cam.x * zoom) * this.dpr, (this.cssH / 2 - this.cam.y * zoom) * this.dpr)

    const viewW = this.cssW / zoom
    const viewH = this.cssH / zoom
    const c1 = clamp(Math.floor((this.cam.x - viewW / 2) / TILE) - 1, 0, world.cols - 1)
    const c2 = clamp(Math.ceil((this.cam.x + viewW / 2) / TILE) + 1, 0, world.cols - 1)
    const r1 = clamp(Math.floor((this.cam.y - viewH / 2) / TILE) - 1, 0, world.rows - 1)
    const r2 = clamp(Math.ceil((this.cam.y + viewH / 2) / TILE) + 1, 0, world.rows - 1)

    drawWorldTiles(g, world.grid, c1, c2, r1, r2, time)

    // props + seats, depth-sorted with the engine's rule so the editor shows what players see
    const items = world.props.map((p) => ({ y: (p.row + p.h) * TILE - (p.type === 'seat' ? 16 : 0), p }))
    items.sort((a, b) => a.y - b.y)
    for (const it of items) drawProp(g, it.p, time)

    if (this.layers.blocked) {
      g.fillStyle = 'rgba(239, 68, 68, 0.4)'
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (isTileBlocked(world, c, r)) g.fillRect(c * TILE, r * TILE, TILE, TILE)
    }

    if (this.layers.grid && zoom > 0.3) {
      g.lineWidth = 1 / zoom
      for (let c = c1; c <= c2 + 1; c++) {
        g.strokeStyle = c % 10 === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)'
        g.beginPath()
        g.moveTo(c * TILE, r1 * TILE)
        g.lineTo(c * TILE, (r2 + 1) * TILE)
        g.stroke()
      }
      for (let r = r1; r <= r2 + 1; r++) {
        g.strokeStyle = r % 10 === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)'
        g.beginPath()
        g.moveTo(c1 * TILE, r * TILE)
        g.lineTo((c2 + 1) * TILE, r * TILE)
        g.stroke()
      }
    }

    g.strokeStyle = '#e2e8f0'
    g.lineWidth = 3 / zoom
    g.strokeRect(0, 0, mapW, mapH)

    if (this.layers.zones) this.drawZones(g, s.map.zones, s.selection, zoom)
    this.drawSpawnAndSelection(g, s, zoom)
    this.drawPreview(g, s, zoom, time)
  }

  private drawZones(g: CanvasRenderingContext2D, zones: ReturnType<EditorModel['getSnapshot']>['map']['zones'], sel: ReturnType<EditorModel['getSnapshot']>['selection'], zoom: number) {
    zones.forEach((z, i) => {
      const [c1, r1, c2, r2] = z.rect
      const x = c1 * TILE
      const y = r1 * TILE
      const w = (c2 - c1 + 1) * TILE
      const h = (r2 - r1 + 1) * TILE
      const hue = (i * 67 + 140) % 360
      const selected = sel?.kind === 'zone' && sel.index === i
      g.fillStyle = `hsla(${hue}, 85%, 60%, ${selected ? 0.2 : 0.12})`
      g.fillRect(x, y, w, h)
      g.setLineDash([10 / zoom, 8 / zoom])
      g.lineWidth = (selected ? 4 : 2.5) / zoom
      g.strokeStyle = `hsl(${hue}, 90%, ${selected ? 75 : 65}%)`
      g.strokeRect(x + 1, y + 1, w - 2, h - 2)
      g.setLineDash([])
      const fs = Math.max(11, 13 / zoom)
      g.font = `600 ${fs}px system-ui, sans-serif`
      const label = `${z.name}  ·  ${z.id}`
      const tw = g.measureText(label).width
      g.fillStyle = 'rgba(15, 23, 42, 0.85)'
      g.beginPath()
      g.roundRect(x + 6, y + 6, tw + 14, fs + 10, 6)
      g.fill()
      g.fillStyle = `hsl(${hue}, 90%, 80%)`
      g.textBaseline = 'middle'
      g.textAlign = 'left'
      g.fillText(label, x + 13, y + 6 + (fs + 10) / 2)
      if (selected) {
        g.fillStyle = '#fff'
        g.strokeStyle = `hsl(${hue}, 90%, 45%)`
        g.lineWidth = 2 / zoom
        const hs = 9 / zoom
        for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]] as const) {
          g.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
          g.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs)
        }
      }
    })
  }

  private drawSpawnAndSelection(g: CanvasRenderingContext2D, s: ReturnType<EditorModel['getSnapshot']>, zoom: number) {
    const [sc, sr] = s.map.spawn
    const cx = (sc + 0.5) * TILE
    const cy = (sr + 0.5) * TILE
    const spawnSel = s.selection?.kind === 'spawn'
    g.fillStyle = 'rgba(34, 197, 94, 0.9)'
    g.beginPath()
    g.arc(cx, cy, TILE * 0.32, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = (spawnSel ? 4 : 2) / zoom
    g.strokeStyle = spawnSel ? '#fde047' : '#fff'
    g.stroke()
    g.fillStyle = '#fff'
    g.font = `700 ${TILE * 0.3}px system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('S', cx, cy + 1)

    const sel = s.selection
    if (!sel || sel.kind === 'spawn' || sel.kind === 'zone') return
    g.strokeStyle = '#fde047'
    g.lineWidth = 3 / zoom
    g.setLineDash([6 / zoom, 5 / zoom])
    if (sel.kind === 'seat') {
      const seat = s.map.seats[sel.index]
      if (seat) g.strokeRect(seat.col * TILE + 2, seat.row * TILE + 2, TILE - 4, TILE - 4)
    } else {
      const raw = s.map.props[sel.index]
      if (raw) {
        const d = propDef(raw.type)!
        g.strokeRect(raw.col * TILE, raw.row * TILE, (raw.w ?? d.w) * TILE, (raw.h ?? d.h) * TILE)
      }
    }
    g.setLineDash([])
  }

  private drawPreview(g: CanvasRenderingContext2D, s: ReturnType<EditorModel['getSnapshot']>, zoom: number, time: number) {
    const pv = this.tools.preview()
    g.lineWidth = 2 / zoom

    if (pv.brush.length) {
      g.fillStyle = 'rgba(255,255,255,0.25)'
      g.strokeStyle = 'rgba(255,255,255,0.9)'
      for (const [c, r] of pv.brush) {
        g.fillRect(c * TILE, r * TILE, TILE, TILE)
        g.strokeRect(c * TILE, r * TILE, TILE, TILE)
      }
    } else if (pv.hover && !pv.ghost && s.tool !== 'select') {
      g.strokeStyle = 'rgba(255,255,255,0.8)'
      g.strokeRect(pv.hover[0] * TILE, pv.hover[1] * TILE, TILE, TILE)
    }
    if (pv.rect) {
      const [c1, r1, c2, r2] = pv.rect
      g.fillStyle = 'rgba(56, 189, 248, 0.25)'
      g.strokeStyle = '#38bdf8'
      g.fillRect(c1 * TILE, r1 * TILE, (c2 - c1 + 1) * TILE, (r2 - r1 + 1) * TILE)
      g.strokeRect(c1 * TILE, r1 * TILE, (c2 - c1 + 1) * TILE, (r2 - r1 + 1) * TILE)
    }
    if (pv.ghost) {
      const gp: Prop = { ...pv.ghost, solid: true }
      g.globalAlpha = 0.6
      drawProp(g, gp, time)
      g.globalAlpha = 1
      g.strokeStyle = '#38bdf8'
      g.strokeRect(gp.col * TILE, gp.row * TILE, gp.w * TILE, gp.h * TILE)
    }
    if (s.tool === 'seat' && pv.hover) {
      const seat = { id: 'ghost', col: pv.hover[0], row: pv.hover[1], dir: s.seatDir, style: s.seatStyle, color: s.seatColor }
      g.globalAlpha = 0.7
      drawProp(g, { type: 'seat', col: seat.col, row: seat.row, w: 1, h: 1, solid: false, seat }, time)
      g.globalAlpha = 1
      g.strokeStyle = '#38bdf8'
      g.strokeRect(seat.col * TILE, seat.row * TILE, TILE, TILE)
    }
  }
}
