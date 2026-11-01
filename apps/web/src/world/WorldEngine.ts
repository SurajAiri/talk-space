import { appearanceFor } from './appearance.ts'
import { HEARING, hearingGain, zoneAt } from './hearing.ts'
import { findPath, isTileBlocked, type Waypoint } from './navigation.ts'
import { drawCharacter, drawCharacterOverlays } from './render/character.ts'
import { drawPropItem, drawWorldTiles } from './render/scene.ts'
import { TILE, type Character, type Seat } from './types.ts'
import type { WorldSession } from './WorldSession.ts'

/**
 * 198 px/s == the template's 3.3 px per frame at 60 fps. The template moved a fixed
 * distance per *frame*, so a 120 Hz phone walked twice as fast as a 60 Hz laptop.
 */
const SPEED = 198
const REMOTE_SMOOTHING = 14 // higher = remote avatars snap to their network position faster
const CAMERA_SMOOTHING = 9
const SNAP_DISTANCE = 6 * TILE // farther than this (join, lag spike): jump instead of gliding across the map
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2
/** Aim to show about this many tiles top to bottom AND this many across, whichever is tighter: a phone held either way and a big monitor all get a comfortable slice. */
const FIT_TILES_TALL = 12
const FIT_TILES_WIDE = 9
const STICK_DEADZONE = 0.16
const TAP_MAX_MS = 600
const TAP_MAX_MOVE = 10 // px: a finger that travels further than this is panning/pinching, not tapping

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

export interface PeerLabel {
  name: string
  muted: boolean
}

export interface EngineOptions {
  canvas: HTMLCanvasElement
  session: WorldSession
  selfId: string
  /** Read every frame (non-reactive): the engine must not depend on React. */
  getSelf: () => PeerLabel
  getPeers: () => Record<string, PeerLabel>
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** True when the keyboard is talking to a form field, not to the avatar. */
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
}

/**
 * Draws the room's map and runs the local avatar. It owns NO networking and NO
 * audio: it writes our position into the WorldSession and reads remote positions
 * out of it, so it can be replaced (e.g. by real Phaser) without touching either.
 */
export class WorldEngine {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly session: WorldSession
  private readonly opts: EngineOptions
  private readonly seats = new Map<string, Seat>()
  private readonly player: Character
  private readonly remote = new Map<string, Character>()
  private readonly keys = new Set<string>()
  private readonly cleanup: (() => void)[] = []

  private path: Waypoint[] = []
  private marker: { x: number; y: number; age: number } | null = null
  private camera: { x: number; y: number }
  private view = { x: 0, y: 0 } // clamped camera centre of the last frame (for click -> world mapping)
  private zoom = 1
  private userZoomed = false // once someone zooms by hand, stop re-fitting on resize/rotation
  private readonly pointers = new Map<number, { x: number; y: number }>()
  private tap: { id: number; x: number; y: number; t: number } | null = null
  private pinch: { dist: number; zoom: number } | null = null
  private dpr = 1
  private cssW = 1
  private cssH = 1
  private raf = 0
  private last = 0

  constructor(opts: EngineOptions) {
    this.opts = opts
    this.canvas = opts.canvas
    this.session = opts.session
    const ctx = opts.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available')
    this.ctx = ctx

    for (const s of opts.session.map.seats) this.seats.set(`${s.col},${s.row}`, s)

    const l = opts.session.local
    this.player = {
      id: opts.selfId,
      name: '',
      flair: '',
      status: 'available',
      isPlayer: true,
      x: l.x * TILE,
      y: l.y * TILE,
      dir: l.dir,
      moving: false,
      walkFrame: 0,
      dancing: false,
      sittingSeat: null,
      speechBubble: null,
      reaction: null,
      ...appearanceFor(opts.selfId),
    }
    this.camera = { x: this.player.x, y: this.player.y }
    this.view = { ...this.camera }
  }

  start() {
    this.listen(window, 'keydown', this.onKeyDown as EventListener)
    this.listen(window, 'keyup', this.onKeyUp as EventListener)
    this.listen(window, 'blur', () => this.keys.clear())
    this.listen(this.canvas, 'pointerdown', this.onPointerDown as EventListener)
    this.listen(this.canvas, 'pointermove', this.onPointerMove as EventListener)
    this.listen(this.canvas, 'pointerup', this.onPointerUp as EventListener)
    this.listen(this.canvas, 'pointercancel', this.onPointerCancel as EventListener)
    this.listen(this.canvas, 'wheel', this.onWheel as EventListener, { passive: false })

    const ro = new ResizeObserver(() => this.resize())
    ro.observe(this.canvas)
    this.cleanup.push(() => ro.disconnect())
    this.resize()

    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    for (const fn of this.cleanup.splice(0)) fn()
    this.keys.clear()
  }

  // ---------- input ----------

  private listen(target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions) {
    target.addEventListener(type, fn, options)
    this.cleanup.push(() => target.removeEventListener(type, fn, options))
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return
    const k = e.key.toLowerCase()
    if (!MOVE_KEYS.has(k)) return
    e.preventDefault() // arrows must not scroll the page
    this.keys.add(k)
    this.session.mixer.resume() // a key press is a user gesture: lets the AudioContext start
  }

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase())
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.session.mixer.resume()
    try {
      this.canvas.setPointerCapture(e.pointerId)
    } catch {
      /* not capturable (synthetic event): fine */
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (e.pointerType === 'mouse') {
      // a click is a click the moment it lands
      if (e.button === 0) this.moveToward(e.clientX, e.clientY)
      return
    }
    if (this.pointers.size === 1) {
      this.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }
    } else {
      // a second finger: this is a pinch, not a tap
      this.tap = null
      this.pinch = { dist: this.pointerSpread(), zoom: this.zoom }
    }
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId)
    if (!p) return
    p.x = e.clientX
    p.y = e.clientY
    if (this.tap && this.tap.id === e.pointerId && Math.hypot(e.clientX - this.tap.x, e.clientY - this.tap.y) > TAP_MAX_MOVE) {
      this.tap = null
    }
    if (this.pinch && this.pointers.size >= 2) {
      const spread = this.pointerSpread()
      if (this.pinch.dist > 0 && spread > 0) {
        this.userZoomed = true
        this.zoom = clamp(this.pinch.zoom * (spread / this.pinch.dist), MIN_ZOOM, MAX_ZOOM)
      }
    }
  }

  private readonly onPointerUp = (e: PointerEvent) => {
    const tap = this.tap
    this.pointers.delete(e.pointerId)
    if (this.pointers.size < 2) this.pinch = null
    if (tap && tap.id === e.pointerId && performance.now() - tap.t < TAP_MAX_MS) this.moveToward(tap.x, tap.y)
    if (tap && tap.id === e.pointerId) this.tap = null
  }

  private readonly onPointerCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    this.tap = null
    if (this.pointers.size < 2) this.pinch = null
  }

  private pointerSpread(): number {
    const [a, b] = [...this.pointers.values()]
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
  }

  /** Walk to the tile under a screen point (if there is a way there). */
  private moveToward(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect()
    const wx = (clientX - rect.left - this.cssW / 2) / this.zoom + this.view.x
    const wy = (clientY - rect.top - this.cssH / 2) / this.zoom + this.view.y
    const path = findPath(
      this.session.map,
      { col: Math.floor(this.player.x / TILE), row: Math.floor(this.player.y / TILE) },
      { col: Math.floor(wx / TILE), row: Math.floor(wy / TILE) },
    )
    if (!path) return // wall, water or unreachable: ignore the tap
    this.path = path
    this.marker = { x: (Math.floor(wx / TILE) + 0.5) * TILE, y: (Math.floor(wy / TILE) + 0.5) * TILE, age: 0 }
  }

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.userZoomed = true
    this.zoom = clamp(this.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), MIN_ZOOM, MAX_ZOOM)
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.cssW = Math.max(1, rect.width)
    this.cssH = Math.max(1, rect.height)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2) // 3x phones would 9x the fill cost for no visible gain
    this.canvas.width = Math.round(this.cssW * this.dpr)
    this.canvas.height = Math.round(this.cssH * this.dpr)
    if (!this.userZoomed) this.zoom = clamp(Math.min(this.cssH / (FIT_TILES_TALL * TILE), this.cssW / (FIT_TILES_WIDE * TILE)), 0.7, 1.3)
  }

  // ---------- loop ----------

  private readonly frame = (t: number) => {
    // Clamp: after a stalled/hidden tab the first dt would be huge and teleport us through a wall.
    const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000))
    this.last = t
    this.update(dt)
    this.render(t)
    this.raf = requestAnimationFrame(this.frame)
  }

  private seatAt(x: number, y: number): Seat | null {
    return this.seats.get(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`) ?? null
  }

  private update(dt: number) {
    const map = this.session.map
    const p = this.player
    const self = this.opts.getSelf()
    p.name = self.name
    p.status = self.muted ? 'busy' : 'available'

    // --- intent: keyboard wins over a click-to-move path ---
    let dx = 0
    let dy = 0
    const k = this.keys
    if (k.has('w') || k.has('arrowup')) dy -= 1
    if (k.has('s') || k.has('arrowdown')) dy += 1
    if (k.has('a') || k.has('arrowleft')) dx -= 1
    if (k.has('d') || k.has('arrowright')) dx += 1

    let maxStep = Infinity
    let followingPath = false
    let speedScale = 1
    const stick = this.session.joystick
    const stickMag = Math.hypot(stick.x, stick.y)
    if (dx !== 0 || dy !== 0) {
      this.path = []
      const len = Math.hypot(dx, dy)
      dx /= len
      dy /= len
    } else if (stickMag > STICK_DEADZONE) {
      // analog: a light push walks slowly, a full push at full speed
      this.path = []
      dx = stick.x / stickMag
      dy = stick.y / stickMag
      speedScale = Math.min(1, (stickMag - STICK_DEADZONE) / (1 - STICK_DEADZONE) * 1.15)
    } else {
      while (this.path.length) {
        const wp = this.path[0]!
        const tx = wp.x - p.x
        const ty = wp.y - p.y
        const dist = Math.hypot(tx, ty)
        if (dist < 0.5) {
          this.path.shift()
          continue
        }
        dx = tx / dist
        dy = ty / dist
        maxStep = dist // never overshoot a waypoint (that would oscillate around it)
        followingPath = true
        break
      }
    }

    // --- move, one axis at a time so we slide along walls instead of sticking ---
    const ox = p.x
    const oy = p.y
    if (dx !== 0 || dy !== 0) {
      p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      const step = Math.min(SPEED * speedScale * dt, maxStep)
      const nx = p.x + dx * step
      const ny = p.y + dy * step
      if (!isTileBlocked(map, Math.floor(nx / TILE), Math.floor(p.y / TILE))) p.x = nx
      if (!isTileBlocked(map, Math.floor(p.x / TILE), Math.floor(ny / TILE))) p.y = ny
    }
    p.moving = Math.hypot(p.x - ox, p.y - oy) > 0.01
    if (followingPath && !p.moving) this.path = [] // walked into something the path did not expect
    if (p.moving) p.walkFrame += dt * 60

    // --- sitting: standing still on a seat tile ---
    const seat = p.moving ? null : this.seatAt(p.x, p.y)
    p.sittingSeat = seat
    if (seat) p.dir = seat.dir

    // --- publish our position (tile units) for the network + hearing logic ---
    const l = this.session.local
    l.x = p.x / TILE
    l.y = p.y / TILE
    l.dir = p.dir
    l.moving = p.moving

    this.updateRemotes(dt)
    this.applyBubbles(performance.now())

    const cam = 1 - Math.exp(-CAMERA_SMOOTHING * dt)
    this.camera.x += (p.x - this.camera.x) * cam
    this.camera.y += (p.y - this.camera.y) * cam
    if (this.marker && (this.marker.age += dt) > 0.8) this.marker = null
  }

  /** Copy what people just said (WorldSession.bubbles) onto the characters that get drawn. */
  private applyBubbles(now: number) {
    const set = (c: Character) => {
      const b = this.session.bubbles.get(c.id)
      if (!b) {
        c.speechBubble = null
        return
      }
      if (now >= b.until) {
        this.session.bubbles.delete(c.id)
        c.speechBubble = null
        return
      }
      c.speechBubble = { text: b.text, dm: b.dm, age: now - b.at, timer: b.until - now }
    }
    set(this.player)
    for (const c of this.remote.values()) set(c)
  }

  private updateRemotes(dt: number) {
    const peers = this.opts.getPeers()
    const smooth = 1 - Math.exp(-REMOTE_SMOOTHING * dt)

    for (const [id, r] of this.session.remotes) {
      const tx = r.x * TILE
      const ty = r.y * TILE
      let c = this.remote.get(id)
      if (!c) {
        c = {
          id,
          name: '',
          flair: '',
          status: 'available',
          isPlayer: false,
          x: tx,
          y: ty,
          dir: r.dir,
          moving: false,
          walkFrame: 0,
          dancing: false,
          sittingSeat: null,
          speechBubble: null,
          reaction: null,
          ...appearanceFor(id),
        }
        this.remote.set(id, c)
      }
      const dist = Math.hypot(tx - c.x, ty - c.y)
      if (dist > SNAP_DISTANCE) {
        c.x = tx
        c.y = ty
      } else {
        c.x += (tx - c.x) * smooth
        c.y += (ty - c.y) * smooth
      }
      c.dir = r.dir
      c.moving = r.moving || dist > 2 // keep walking until the glide actually arrives
      if (c.moving) c.walkFrame += dt * 60
      c.sittingSeat = c.moving ? null : this.seatAt(c.x, c.y)
      if (c.sittingSeat) c.dir = c.sittingSeat.dir

      const peer = peers[id]
      c.name = peer?.name ?? 'Someone'
      c.status = peer?.muted === false ? 'available' : 'busy'
    }
    for (const id of [...this.remote.keys()]) if (!this.session.remotes.has(id)) this.remote.delete(id)
  }

  // ---------- drawing ----------

  private render(time: number) {
    const { ctx, canvas, session, zoom, dpr } = this
    const map = session.map
    const mapW = map.cols * TILE
    const mapH = map.rows * TILE

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const viewW = this.cssW / zoom
    const viewH = this.cssH / zoom
    // keep the camera inside the map (or centred when the map is smaller than the view)
    const cx = viewW >= mapW ? mapW / 2 : clamp(this.camera.x, viewW / 2, mapW - viewW / 2)
    const cy = viewH >= mapH ? mapH / 2 : clamp(this.camera.y, viewH / 2, mapH - viewH / 2)
    this.view = { x: cx, y: cy }

    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, (this.cssW / 2 - cx * zoom) * dpr, (this.cssH / 2 - cy * zoom) * dpr)

    const startCol = Math.max(0, Math.floor((cx - viewW / 2) / TILE) - 1)
    const endCol = Math.min(map.cols - 1, Math.ceil((cx + viewW / 2) / TILE) + 1)
    const startRow = Math.max(0, Math.floor((cy - viewH / 2) / TILE) - 1)
    const endRow = Math.min(map.rows - 1, Math.ceil((cy + viewH / 2) / TILE) + 1)

    drawWorldTiles(ctx, map.grid, startCol, endCol, startRow, endRow, time)
    this.drawHearingGuides()

    if (this.marker) {
      ctx.strokeStyle = `rgba(52, 211, 153, ${1 - this.marker.age / 0.8})`
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(this.marker.x, this.marker.y, 8 + this.marker.age * 18, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Props and people share one depth-sorted pass so you walk behind trees and in front of tables.
    const items: { sortY: number; draw: () => void }[] = []
    for (const p of map.props) {
      items.push({ sortY: (p.row + p.h) * TILE - (p.type === 'seat' ? 16 : 0), draw: () => drawPropItem(ctx, p, time) })
    }
    const people = [this.player, ...this.remote.values()]
    for (const c of people) {
      items.push({
        sortY: c.y + 12,
        draw: () => {
          ctx.globalAlpha = this.alphaFor(c)
          drawCharacter(ctx, c, c.x, c.y, 1, time)
          ctx.globalAlpha = 1
        },
      })
    }
    items.sort((a, b) => a.sortY - b.sortY)
    for (const it of items) it.draw()

    // zoomed out (a phone): grow the name tags and bubbles so they stay readable
    const overlayScale = clamp(1 / zoom, 0.85, 1.5)
    const halfWide = this.cssW / (2 * zoom) // world units from the camera centre to the screen edge
    for (const c of people) {
      ctx.globalAlpha = this.alphaFor(c)
      // bubbles slide sideways to stay readable when someone stands at the edge of the screen
      drawCharacterOverlays(ctx, c, time, overlayScale, { minX: this.view.x - halfWide - c.x, maxX: this.view.x + halfWide - c.x })
    }
    ctx.globalAlpha = 1
  }

  /** People we cannot hear (and who cannot hear us) are drawn faded: the audio rule made visible. */
  private alphaFor(c: Character): number {
    if (c.isPlayer) return 1
    const r = this.session.remotes.get(c.id)
    if (!r) return 1
    return hearingGain(this.session.map, this.session.local, r) > 0 ? 1 : 0.4
  }

  private drawHearingGuides() {
    const { ctx, session } = this
    const me = session.local
    const here = zoneAt(session.map, me.x, me.y)

    for (const z of session.map.zones) {
      const { c1, r1, c2, r2 } = z.rect
      const x = c1 * TILE
      const y = r1 * TILE
      const w = (c2 - c1 + 1) * TILE
      const h = (r2 - r1 + 1) * TILE
      const active = here?.id === z.id

      if (active) {
        ctx.fillStyle = 'rgba(52, 211, 153, 0.07)'
        ctx.fillRect(x, y, w, h)
      }
      ctx.setLineDash([10, 8])
      ctx.lineWidth = active ? 3 : 2
      ctx.strokeStyle = active ? 'rgba(52, 211, 153, 0.9)' : 'rgba(255, 255, 255, 0.35)'
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3)
      ctx.setLineDash([])

      ctx.font = '600 12px system-ui, sans-serif'
      const label = `🔊 ${z.name}`
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'
      ctx.beginPath()
      ctx.roundRect(x + 8, y + 8, tw + 14, 22, 8)
      ctx.fill()
      ctx.fillStyle = active ? '#6ee7b7' : '#e2e8f0'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x + 15, y + 19.5)
    }

    if (!here) {
      // Open area: show how far your voice carries (solid = full volume, dashed = fades to nothing).
      const px = me.x * TILE
      const py = me.y * TILE
      ctx.lineWidth = 2
      ctx.setLineDash([6, 8])
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)'
      ctx.beginPath()
      ctx.arc(px, py, HEARING.maxRadius * TILE, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.22)'
      ctx.beginPath()
      ctx.arc(px, py, HEARING.fullRadius * TILE, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}
