import { lookFor } from './avatar.ts'
import { emoteById, reactionById, REACTION_MS } from './fx.ts'
import { clampZoom, fitZoom, wheelZoomFactor, zoomLimits, type ZoomLimits } from './camera.ts'
import { HEARING, hearingGain, zoneAt } from './hearing.ts'
import { findPath, isTileBlocked, type Waypoint } from './navigation.ts'
import { seatKind } from './assets/seats.ts'
import { exitTile, nearestSeat, promptFor, seatAnchor, seatedOn, seatIndex, seatInTile, type Prompt, type SeatIndex } from './interact.ts'
import { drawCharacter, drawCharacterOverlays } from './render/character.ts'
import { drawDepthSorted, drawNight, drawWorldTiles, nightPropsOf, propDepthItems, type DepthItem } from './render/scene.ts'
import { TILE, type Character, type Prop, type Seat } from './types.ts'
import type { WorldSession } from './WorldSession.ts'

/**
 * 198 px/s == the template's 3.3 px per frame at 60 fps. The template moved a fixed
 * distance per *frame*, so a 120 Hz phone walked twice as fast as a 60 Hz laptop.
 */
const SPEED = 198
const REMOTE_SMOOTHING = 14 // higher = remote avatars snap to their network position faster
const CAMERA_SMOOTHING = 9
const SNAP_DISTANCE = 6 * TILE // farther than this (join, lag spike): jump instead of gliding across the map
const STICK_DEADZONE = 0.16
const TAP_MAX_MS = 600
const TAP_MAX_MOVE = 10 // px: a finger that travels further than this is panning/pinching, not tapping

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

export interface PeerLabel {
  name: string
  muted: boolean
  /** their designed character (see world/avatar.ts); null/absent = the look generated from their id */
  avatar?: unknown
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
  private readonly seats: SeatIndex
  private readonly statics: DepthItem[] // every prop's paint passes, sorted back to front (props never move)
  private readonly player: Character
  private readonly remote = new Map<string, Character>()
  private readonly keys = new Set<string>()
  private readonly cleanup: (() => void)[] = []

  private path: Waypoint[] = []
  /** the seat I am walking to / was asked to sit on: it seats me on arrival even if it is a beach bed that never seats you by itself */
  private intent: Seat | null = null
  /** the seat I just stood up from: do not pull me back onto it until I have left its tile */
  private dismissed: Seat | null = null
  /** what the on-screen action offers right now ("Sit", "Lie down", "Stand up"), and when it appeared (ms), for its fade-in */
  private prompt: { prompt: Prompt; since: number; rect: { x: number; y: number; w: number; h: number } | null } | null = null
  private hoverSeat: Seat | null = null
  /** the timestamp of the frame being drawn: the button's fade-in runs on the frame clock, not the wall clock */
  private clock = 0
  private hoverPrompt = false
  private readonly coarse: boolean // a phone or tablet: no keyboard hint on the button
  private marker: { x: number; y: number; age: number } | null = null
  private camera: { x: number; y: number }
  private view = { x: 0, y: 0 } // clamped camera centre of the last frame (for click -> world mapping)
  private zoom = 1
  private readonly appliedAvatar = new Map<string, unknown>()
  private lastEmoteAt = -1
  private limits: ZoomLimits = { min: 0.5, max: 1.8 } // set for real in resize(): they depend on the screen and the map
  private readonly night: Prop[] // props that throw light or hang overhead (empty on daytime maps)
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
    const ctx = opts.canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D is not available')
    this.ctx = ctx

    this.seats = seatIndex(opts.session.map.seats)
    this.statics = propDepthItems(opts.session.map.props)
    this.night = nightPropsOf(opts.session.map.props)
    this.coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

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
      ...lookFor(opts.selfId, opts.getSelf().avatar),
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
    this.listen(this.canvas, 'pointerleave', this.onPointerLeave as EventListener)
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
    if (k === 'e') {
      // sit / lie down / stand up
      e.preventDefault()
      if (!e.repeat) this.interact()
      this.session.mixer.resume()
      return
    }
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
      if (e.button === 0 && !this.pressPrompt(e.clientX, e.clientY)) this.moveToward(e.clientX, e.clientY)
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
    if (e.pointerType === 'mouse') this.updateHover(e.clientX, e.clientY)
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
        this.zoom = clampZoom(this.pinch.zoom * (spread / this.pinch.dist), this.limits)
      }
    }
  }

  private readonly onPointerUp = (e: PointerEvent) => {
    const tap = this.tap
    this.pointers.delete(e.pointerId)
    if (this.pointers.size < 2) this.pinch = null
    if (tap && tap.id === e.pointerId && performance.now() - tap.t < TAP_MAX_MS && !this.pressPrompt(tap.x, tap.y)) this.moveToward(tap.x, tap.y)
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

  private readonly onPointerLeave = () => {
    this.hoverSeat = null
    this.hoverPrompt = false
    this.canvas.style.cursor = ''
  }

  /** A screen point in world pixels. */
  private toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return { x: (clientX - rect.left - this.cssW / 2) / this.zoom + this.view.x, y: (clientY - rect.top - this.cssH / 2) / this.zoom + this.view.y }
  }

  /** Walk to the tile under a screen point (if there is a way there). Clicking a seat means "sit there". */
  private moveToward(clientX: number, clientY: number) {
    const w = this.toWorld(clientX, clientY)
    this.walkToTile(Math.floor(w.x / TILE), Math.floor(w.y / TILE))
  }

  /** True (and acts) if the press landed on the on-screen Sit / Stand up button. */
  private pressPrompt(clientX: number, clientY: number): boolean {
    const r = this.prompt?.rect
    if (!r) return false
    const w = this.toWorld(clientX, clientY)
    if (w.x < r.x || w.x > r.x + r.w || w.y < r.y || w.y > r.y + r.h) return false
    this.interact()
    return true
  }

  /** Mouse only: light up the seat under the pointer, and show a hand over seats and the button. */
  private updateHover(clientX: number, clientY: number) {
    const w = this.toWorld(clientX, clientY)
    const r = this.prompt?.rect
    this.hoverPrompt = Boolean(r && w.x >= r.x && w.x <= r.x + r.w && w.y >= r.y && w.y <= r.y + r.h)
    const seat = seatInTile(this.seats, w.x, w.y)
    this.hoverSeat = seat && !this.isTaken(seat) && seat !== this.player.sittingSeat ? seat : null
    this.canvas.style.cursor = this.hoverPrompt || this.hoverSeat ? 'pointer' : ''
  }

  // ---------- sitting, lying down, standing up ----------

  /** Is somebody else on this seat? */
  private isTaken(seat: Seat): boolean {
    for (const c of this.remote.values()) if (c.sittingSeat?.id === seat.id) return true
    return false
  }

  /** The action button / E key: stand up if I am seated, otherwise sit (or lie) on the seat the button offers. */
  interact() {
    const p = this.player
    if (p.sittingSeat) return this.standUp(p.sittingSeat)
    const near = this.prompt?.prompt.kind === 'sit' ? this.prompt.prompt.seat : null
    if (near) this.sitOn(near)
  }

  /** Walk onto a seat's anchor (a few px if I am already beside it) and settle into it. */
  private sitOn(seat: Seat) {
    if (this.isTaken(seat)) return
    const p = this.player
    const a = seatAnchor(seat)
    const path = findPath(this.session.map, { col: Math.floor(p.x / TILE), row: Math.floor(p.y / TILE) }, { col: seat.col, row: seat.row })
    if (!path) return
    this.intent = seat
    this.dismissed = null
    this.path = path.length ? path : [{ x: a.x, y: a.y }]
    this.marker = { x: a.x, y: a.y, age: 0 }
  }

  /** Get up: step out in front of the seat. (Stepping off by keys or by a click just walks away, which also stands you up.) */
  private standUp(seat: Seat) {
    this.dismissed = seat
    this.intent = null
    const t = exitTile(this.session.map, this.seats, seat)
    if (t) this.path = [{ x: (t.col + 0.5) * TILE, y: (t.row + 0.5) * TILE }]
  }

  /** Walk to a tile (if there is a way there). Shared by taps on the map and clicks on the minimap. */
  private walkToTile(col: number, row: number) {
    let seat = this.seats.get(`${col},${row}`) ?? null
    if (seat && this.isTaken(seat)) {
      // somebody is already sitting there: walk up to it, not into them
      const t = exitTile(this.session.map, this.seats, seat)
      if (!t) return
      col = t.col
      row = t.row
      seat = null
    }
    const path = findPath(this.session.map, { col: Math.floor(this.player.x / TILE), row: Math.floor(this.player.y / TILE) }, { col, row })
    if (!path) return // wall, water or unreachable: ignore it
    this.intent = seat // you clicked a free seat: you meant to sit
    this.dismissed = null
    this.path = path.length || !seat ? path : [seatAnchor(seat)]
    this.marker = { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE, age: 0 }
  }

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.userZoomed = true
    this.zoom = clampZoom(this.zoom * wheelZoomFactor(e.deltaY, e.deltaMode), this.limits)
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect()
    this.cssW = Math.max(1, rect.width)
    this.cssH = Math.max(1, rect.height)
    this.dpr = Math.min(window.devicePixelRatio || 1, 2) // 3x phones would 9x the fill cost for no visible gain
    const w = Math.round(this.cssW * this.dpr)
    const h = Math.round(this.cssH * this.dpr)
    // Assigning canvas.width / height wipes the bitmap EVEN when the value is unchanged, so only touch them when the
    // size really changed (phones fire resize for address-bar and safe-area tweaks that change nothing).
    if (this.canvas.width !== w) this.canvas.width = w
    if (this.canvas.height !== h) this.canvas.height = h
    // the limits follow the window (and the map), so a resized or rotated screen can never leave the zoom outside them
    this.limits = zoomLimits(this.cssW, this.cssH, this.session.map.cols, this.session.map.rows)
    this.zoom = this.userZoomed ? clampZoom(this.zoom, this.limits) : fitZoom(this.cssW, this.cssH, this.limits)
    // ResizeObserver callbacks run AFTER this frame's requestAnimationFrame and just BEFORE the screen is painted. A
    // wiped canvas would therefore be shown blank for one frame (the flicker). Redraw right now so it never is.
    if (this.raf) this.render(performance.now())
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
      this.intent = null
      const len = Math.hypot(dx, dy)
      dx /= len
      dy /= len
    } else if (stickMag > STICK_DEADZONE) {
      // analog: a light push walks slowly, a full push at full speed
      this.path = []
      this.intent = null
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

    // --- seats ---
    // Sitting is derived from where I am (interact.ts), the same rule every other screen applies to me. What happens
    // here is only the walking: leaving a seat, and gliding onto one.
    const wasSeated = p.sittingSeat
    const idle = dx === 0 && dy === 0
    if (wasSeated && !idle) {
      this.dismissed = wasSeated // I chose to get up: do not pull me back while I am still on its tile
      this.intent = null
    }
    const here = seatInTile(this.seats, p.x, p.y)
    if (this.dismissed && here !== this.dismissed) this.dismissed = null
    if (idle && !p.moving && this.path.length === 0 && here && here !== this.dismissed) {
      // standing still on a seat's tile but not on its middle: settle onto it, if it is the kind that seats you (or I asked)
      const a = seatAnchor(here)
      if (Math.hypot(p.x - a.x, p.y - a.y) > 0.5 && (seatKind(here.style).auto || this.intent === here) && !this.isTaken(here)) this.path = [a]
    }
    p.sittingSeat = seatedOn(this.seats, p.x, p.y, p.moving)
    if (this.intent && p.sittingSeat === this.intent) this.intent = null // arrived
    if (p.sittingSeat) p.dir = p.sittingSeat.dir
    p.sitT = p.sittingSeat ? Math.min(1, (p.sitT ?? 0) + dt * 4.2) : 0

    // --- publish our position (tile units) for the network + hearing logic ---
    const l = this.session.local
    l.x = p.x / TILE
    l.y = p.y / TILE
    l.dir = p.dir
    l.moving = p.moving

    this.updateRemotes(dt)
    this.updateSeatState()
    this.applyBubbles(performance.now())
    this.applyFx(performance.now())

    const walk = this.session.takeWalkRequest()
    if (walk) this.walkToTile(walk.col, walk.row)

    const cam = 1 - Math.exp(-CAMERA_SMOOTHING * dt)
    this.camera.x += (p.x - this.camera.x) * cam
    this.camera.y += (p.y - this.camera.y) * cam
    if (this.marker && (this.marker.age += dt) > 0.8) this.marker = null
  }

  /** Mark taken seats (beanbags squash) and work out what the Sit / Stand up button says right now. */
  private updateSeatState() {
    const p = this.player
    const map = this.session.map
    for (const s of map.seats) s.taken = false
    if (p.sittingSeat) p.sittingSeat.taken = true
    for (const c of this.remote.values()) if (c.sittingSeat) c.sittingSeat.taken = true

    // the button shows when I am settled (Stand up) or standing still near a free seat (Sit / Lie down)
    const settled = !p.moving && this.path.length === 0
    const near = settled && !p.sittingSeat ? nearestSeat(map.seats, p.x, p.y, (s) => !this.isTaken(s)) : null
    const next = settled ? promptFor(p.sittingSeat, near) : null
    if (!next) {
      this.prompt = null
    } else if (!this.prompt || this.prompt.prompt.kind !== next.kind || this.prompt.prompt.seat !== next.seat) {
      this.prompt = { prompt: next, since: this.clock, rect: null }
    } else {
      this.prompt.prompt = next
    }
    if (this.hoverSeat && this.isTaken(this.hoverSeat)) this.hoverSeat = null
  }

  /**
   * Copy the emotes and reactions in play (WorldSession) onto the characters that get drawn. Walking ends an
   * emote for everyone (a remote person's `moving` comes from their position messages), and starting one
   * stops our own click-to-move path so it does not walk us out of it at once.
   */
  private applyFx(now: number) {
    const set = (c: Character) => {
      const e = this.session.emotes.get(c.id)
      const def = e ? emoteById(e.id) : undefined
      if (e && def && now - e.at < def.ms && !c.moving) {
        c.emote = { id: e.id, age: now - e.at }
      } else {
        if (e) this.session.emotes.delete(c.id)
        c.emote = null
      }

      const r = this.session.reactions.get(c.id)
      const rdef = r ? reactionById(r.id) : undefined
      const total = rdef ? REACTION_MS[rdef.kind] : 0
      if (r && rdef && now - r.at < total) {
        c.reaction = { kind: rdef.kind, text: rdef.text, style: rdef.style, color: rdef.color, age: now - r.at, timer: total - (now - r.at) }
      } else {
        if (r) this.session.reactions.delete(c.id)
        c.reaction = null
      }
    }
    const mine = this.session.emotes.get(this.player.id)
    if (mine && mine.at !== this.lastEmoteAt) {
      this.lastEmoteAt = mine.at
      this.path = []
    }
    set(this.player)
    for (const c of this.remote.values()) set(c)
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
          ...lookFor(id, peers[id]?.avatar),
        }
        this.remote.set(id, c)
        this.appliedAvatar.set(id, peers[id]?.avatar)
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
      c.sittingSeat = seatedOn(this.seats, c.x, c.y, c.moving)
      if (c.sittingSeat) c.dir = c.sittingSeat.dir
      c.sitT = c.sittingSeat ? Math.min(1, (c.sitT ?? 0) + dt * 4.2) : 0

      const peer = peers[id]
      if (peer && this.appliedAvatar.get(id) !== peer.avatar) {
        Object.assign(c, lookFor(id, peer.avatar)) // their character changed (they re-joined with a new look)
        this.appliedAvatar.set(id, peer.avatar)
      }
      c.name = peer?.name ?? 'Someone'
      c.status = peer?.muted === false ? 'available' : 'busy'
    }
    for (const id of [...this.remote.keys()]) {
      if (!this.session.remotes.has(id)) {
        this.remote.delete(id)
        this.appliedAvatar.delete(id)
      }
    }
  }

  // ---------- drawing ----------

  private render(time: number) {
    this.clock = time
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
    // tell the minimap what is on screen (tile units)
    const vp = session.viewport
    vp.x = cx / TILE
    vp.y = cy / TILE
    vp.w = viewW / TILE
    vp.h = viewH / TILE

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

    this.drawSeatRings(time)

    // Props and people share one depth-sorted pass so you walk behind trees and in front of tables. A sofa or an
    // armchair has two halves (propDepthItems), so the person sitting in it lands between them.
    const people = [this.player, ...this.remote.values()]
    const peopleItems = people.map((c) => ({
      sortY: c.y + 12,
      draw: () => {
        ctx.globalAlpha = this.alphaFor(c)
        drawCharacter(ctx, c, c.x, c.y, 1, time)
        ctx.globalAlpha = 1
      },
    }))
    drawDepthSorted(ctx, this.statics, peopleItems, time, { x1: cx - viewW / 2, y1: cy - viewH / 2, x2: cx + viewW / 2, y2: cy + viewH / 2 })

    // lanterns and signs add light, string lights hang over everyone: after the people, before the name tags
    drawNight(ctx, this.night, time, { x1: cx - viewW / 2, y1: cy - viewH / 2, x2: cx + viewW / 2, y2: cy + viewH / 2 })

    // zoomed out (a phone): grow the name tags and bubbles so they stay readable
    const overlayScale = clamp(1 / zoom, 0.85, 1.5)
    const halfWide = this.cssW / (2 * zoom) // world units from the camera centre to the screen edge
    for (const c of people) {
      ctx.globalAlpha = this.alphaFor(c)
      // bubbles slide sideways to stay readable when someone stands at the edge of the screen
      drawCharacterOverlays(ctx, c, time, overlayScale, { minX: this.view.x - halfWide - c.x, maxX: this.view.x + halfWide - c.x })
    }
    ctx.globalAlpha = 1
    this.drawPrompt(overlayScale, time)
  }

  /** A soft ring on the ground under the seat the button is offering (and under the one the mouse is over). */
  private drawSeatRings(time: number) {
    const { ctx } = this
    const ring = (seat: Seat, strong: boolean) => {
      const a = seatAnchor(seat)
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.006)
      const lie = seatKind(seat.style).posture === 'lie'
      const long = lie && (seat.dir === 'up' || seat.dir === 'down')
      const wide = lie && !long
      ctx.save()
      ctx.lineWidth = 2.2
      ctx.strokeStyle = strong ? `rgba(52, 211, 153, ${0.55 + pulse * 0.4})` : 'rgba(255, 255, 255, 0.7)'
      ctx.fillStyle = strong ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.1)'
      ctx.beginPath()
      ctx.ellipse(a.x, a.y + 4, long ? 19 : wide ? 30 : 23 + pulse * (strong ? 1.5 : 0), long ? 29 : wide ? 18 : 15 + pulse * (strong ? 1 : 0), 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    const offered = this.prompt?.prompt.kind === 'sit' ? this.prompt.prompt.seat : null
    if (this.hoverSeat && this.hoverSeat !== offered) ring(this.hoverSeat, false)
    if (offered) ring(offered, true)
  }

  /** The "Sit / Lie down / Stand up" button, in the world next to what it acts on. Clicking or tapping it, or pressing E, does it. */
  private drawPrompt(scale: number, time: number) {
    const st = this.prompt
    if (!st) return
    const { ctx } = this
    const p = this.player
    const age = (time - st.since) / 1000
    const appear = Math.min(1, age / 0.18)
    if (appear <= 0) return
    const pop = 1 + 1.70158 * Math.pow(appear - 1, 3) + 1.70158 * Math.pow(appear - 1, 2) // overshoots a little, then settles

    const seat = st.prompt.seat
    const a = seatAnchor(seat)
    // on whichever side of the seat the player is NOT on, so the button never covers them. Standing up: just below me.
    const stand = st.prompt.kind === 'stand'
    const below = stand ? true : p.y < a.y - 6
    // never let it slide off the edge of the screen: a seat at the very edge still gets a button you can reach
    const halfW = this.cssW / this.zoom / 2
    const halfH = this.cssH / this.zoom / 2
    const margin = 22 * scale
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const cx = clamp(stand ? p.x : a.x, this.view.x - halfW + margin * 2.4, this.view.x + halfW - margin * 2.4)
    const cy = clamp(stand ? p.y + 38 : below ? a.y + 40 : a.y - 40, this.view.y - halfH + margin, this.view.y + halfH - margin)

    const label = st.prompt.label
    const big = this.coarse
    const h = (big ? 36 : 28) * scale
    const keyW = big ? 0 : 20 * scale
    ctx.save()
    ctx.font = `600 ${(big ? 15 : 13) * scale}px 'Instrument Sans Variable', Inter, system-ui, sans-serif`
    const tw = ctx.measureText(label).width
    const padL = (big ? 16 : 8) * scale
    const w = padL + keyW + (keyW ? 8 * scale : 0) + tw + 14 * scale
    const hover = this.hoverPrompt
    const bob = Math.sin(time * 0.005) * 1.4 * scale

    ctx.translate(cx, cy + bob)
    ctx.scale(pop, pop)
    ctx.globalAlpha = Math.min(1, appear * 1.4)
    // pointer tail towards what it acts on
    ctx.shadowColor = 'rgba(8, 12, 30, 0.4)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 3
    ctx.fillStyle = hover ? '#10b981' : 'rgba(12, 18, 38, 0.94)'
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2)
    const t = 6 * scale
    if (stand || below) {
      ctx.moveTo(-t, -h / 2 + 0.5)
      ctx.lineTo(t, -h / 2 + 0.5)
      ctx.lineTo(0, -h / 2 - t)
    } else {
      ctx.moveTo(-t, h / 2 - 0.5)
      ctx.lineTo(t, h / 2 - 0.5)
      ctx.lineTo(0, h / 2 + t)
    }
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = hover ? 'rgba(255, 255, 255, 0.9)' : 'rgba(52, 211, 153, 0.8)'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2)
    ctx.stroke()

    let x = -w / 2 + padL
    if (keyW) {
      ctx.fillStyle = hover ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.16)'
      ctx.beginPath()
      ctx.roundRect(x, -keyW / 2 + 1 * scale, keyW, keyW - 2 * scale, 5 * scale)
      ctx.fill()
      ctx.fillStyle = '#f8fafc'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('E', x + keyW / 2, 1.2 * scale)
      x += keyW + 8 * scale
    }
    ctx.fillStyle = '#f8fafc'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x, 1 * scale)
    ctx.restore()

    // remembered in WORLD pixels (before the pop-in scale) so the pointer can hit it
    st.rect = { x: cx - w / 2, y: cy - h / 2, w, h }
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
