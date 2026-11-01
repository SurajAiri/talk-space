import type { PosMessage } from '../webrtc/types.ts'
import { hearingGain, zoneAt } from './hearing.ts'
import { isTileBlocked } from './navigation.ts'
import { ProximityMixer } from './ProximityMixer.ts'
import { hash32 } from './appearance.ts'
import type { Dir, WorldMap } from './types.ts'

/** Tile units. */
export interface PositionState {
  x: number
  y: number
  dir: Dir
  moving: boolean
}

export interface HudSnapshot {
  zoneName: string | null
  /** peerId -> 0..1, how well we hear each other right now */
  hearing: Record<string, number>
}

const TICK_MS = 100
const HEARTBEAT_MS = 1000
/**
 * Fastest a remote avatar may move. Positions come from other people's browsers, so a modified
 * client could claim to teleport next to anyone. Honest movement is far below this; anything faster
 * is turned into a fast walk toward the claimed spot rather than believed.
 */
const MAX_REMOTE_SPEED = 14 // tiles per second
const SPEED_SLACK = 1.5 // tiles: network jitter, bursts after a hidden tab wakes up
/** Stop sending our voice to someone only after they have been out of earshot this long (no flapping at the edge). */
const AUDIO_OFF_DELAY_MS = 1000

const round2 = (n: number) => Math.round(n * 100) / 100

/** A line of chat shown above someone's head for a few seconds. Times are performance.now() ms. */
export interface Bubble {
  text: string
  /** a direct message: drawn differently so nobody mistakes it for something the whole room saw */
  dm: boolean
  at: number
  until: number
}
const BUBBLE_MIN_MS = 3500
const BUBBLE_MAX_MS = 8000
const BUBBLE_MS_PER_CHAR = 55 // roughly reading speed, plus a base for noticing it

/**
 * Everything about the room's world that must keep working even when nothing is
 * being drawn (hidden tab, canvas unmounted): who is where, who can hear whom.
 *
 * Rendering and input live in WorldEngine and merely read/write this object.
 * A 100 ms timer (not requestAnimationFrame, which stops in background tabs)
 *   1. broadcasts our position when it changed, plus a 1 s heartbeat, and
 *   2. recomputes every peer's volume from the hearing rules.
 */
export class WorldSession {
  readonly map: WorldMap
  readonly mixer = new ProximityMixer()
  /** peerId -> last position received (tile units, already clamped) */
  readonly remotes = new Map<string, PositionState>()
  readonly local: PositionState
  /** personId -> what they just said (newest only). The engine draws it; chat feeds it. */
  readonly bubbles = new Map<string, Bubble>()
  /** On-screen joystick, -1..1 on each axis (0,0 = released). Written by the UI, read by the engine. */
  readonly joystick = { x: 0, y: 0 }

  private send: ((msg: PosMessage) => void) | null = null
  private audioGate: ((id: string, on: boolean) => void) | null = null
  private blocked: ReadonlySet<string> = new Set()
  private readonly remoteSeenAt = new Map<string, number>()
  /** what we last told the network about each peer's audio, and since when they have been out of range */
  private readonly gated = new Map<string, boolean>()
  private readonly outOfRangeSince = new Map<string, number>()
  private lastSent: PositionState | null = null
  private lastSentAt = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private hud: HudSnapshot = { zoneName: null, hearing: {} }
  private hudKey = ''
  private readonly listeners = new Set<(h: HudSnapshot) => void>()

  constructor(opts: { map: WorldMap; selfId: string }) {
    this.map = opts.map
    const spawn = pickSpawn(opts.map, opts.selfId)
    this.local = { x: spawn.col + 0.5, y: spawn.row + 0.5, dir: 'down', moving: false }
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  /** (Re)bind to a fresh network. Anything learned from the old one is stale. */
  attach(send: (msg: PosMessage) => void, audioGate?: (id: string, on: boolean) => void) {
    this.send = send
    this.audioGate = audioGate ?? null
    this.lastSent = null // force an immediate broadcast to the new peers
    this.clearRemotes()
  }

  /** Network is gone (reconnecting). Peers are unknown until we re-join. */
  detach() {
    this.send = null
    this.audioGate = null
    this.clearRemotes()
  }

  /** People this browser ignores: silent, and they get none of our voice either. */
  setBlockedIds(ids: ReadonlySet<string>) {
    this.blocked = new Set(ids)
    this.updateHearing()
  }

  clearRemotes() {
    this.remotes.clear()
    this.remoteSeenAt.clear()
    this.gated.clear()
    this.outOfRangeSince.clear()
    this.mixer.detachAll()
    this.publish()
  }

  onRemotePosition(id: string, msg: PosMessage) {
    // Untrusted input: keep it inside the map no matter what the peer claims...
    let x = Math.min(Math.max(msg.x, 0), this.map.cols - 0.01)
    let y = Math.min(Math.max(msg.y, 0), this.map.rows - 0.01)

    // ...and don't let it teleport: limit how far it can move since we last heard from it.
    const prev = this.remotes.get(id)
    const now = performance.now()
    const before = this.remoteSeenAt.get(id)
    if (prev && before !== undefined) {
      const allowed = MAX_REMOTE_SPEED * ((now - before) / 1000) + SPEED_SLACK
      const dx = x - prev.x
      const dy = y - prev.y
      const dist = Math.hypot(dx, dy)
      if (dist > allowed) {
        x = prev.x + (dx / dist) * allowed
        y = prev.y + (dy / dist) * allowed
      }
    }
    this.remoteSeenAt.set(id, now)
    this.remotes.set(id, { x, y, dir: msg.dir, moving: msg.moving })
  }

  onPeerStream(id: string, stream: MediaStream) {
    this.mixer.attach(id, stream)
    this.updateHearing() // set the right volume now, not 100 ms from now
  }

  setJoystick(x: number, y: number) {
    this.joystick.x = x
    this.joystick.y = y
  }

  /** Show `text` above `id`'s head. A newer line replaces the older one. */
  say(id: string, text: string, dm = false, now = performance.now()) {
    const clean = text.replace(/\s+/g, ' ').trim()
    if (!clean) return
    const ms = Math.min(BUBBLE_MAX_MS, Math.max(BUBBLE_MIN_MS, 2000 + clean.length * BUBBLE_MS_PER_CHAR))
    this.bubbles.set(id, { text: clean, dm, at: now, until: now + ms })
  }

  onPeerLeft(id: string) {
    this.bubbles.delete(id)
    this.remotes.delete(id)
    this.remoteSeenAt.delete(id)
    this.gated.delete(id)
    this.outOfRangeSince.delete(id)
    this.mixer.detach(id)
    this.publish()
  }

  subscribe(cb: (h: HudSnapshot) => void): () => void {
    this.listeners.add(cb)
    cb(this.hud)
    return () => this.listeners.delete(cb)
  }

  close() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.send = null
    this.listeners.clear()
    this.remotes.clear()
    this.bubbles.clear()
    this.mixer.close()
  }

  private tick() {
    this.broadcastLocal()
    this.updateHearing()
  }

  private broadcastLocal() {
    if (!this.send) return
    const l = this.local
    const now = performance.now()
    const p = this.lastSent
    const changed =
      !p || p.x !== round2(l.x) || p.y !== round2(l.y) || p.dir !== l.dir || p.moving !== l.moving
    if (!changed && now - this.lastSentAt < HEARTBEAT_MS) return
    const msg: PosMessage = { type: 'pos', x: round2(l.x), y: round2(l.y), dir: l.dir, moving: l.moving }
    this.send(msg)
    this.lastSent = { x: msg.x, y: msg.y, dir: msg.dir, moving: msg.moving }
    this.lastSentAt = now
  }

  private updateHearing() {
    const hearing: Record<string, number> = {}
    const now = performance.now()
    for (const [id, remote] of this.remotes) {
      const blocked = this.blocked.has(id)
      const g = blocked ? 0 : hearingGain(this.map, this.local, remote)
      hearing[id] = g
      this.mixer.setGain(id, g)
      this.gateAudio(id, g > 0, blocked, now)
    }
    this.hud = { zoneName: zoneAt(this.map, this.local.x, this.local.y)?.name ?? null, hearing }
    this.publish()
  }

  /**
   * Hearing is symmetrical, so we can work out whether this person can hear us. If not, our
   * browser stops sending them our voice at all: nothing is uploaded for people out of earshot
   * (this is what keeps a crowded mesh affordable), and an unmodified client there receives
   * nothing. A modified client could lie about its position to be sent audio, so this is a bandwidth and
   * comfort feature, not a hard privacy wall: only a server in the audio path could be one.
   */
  private gateAudio(id: string, inRange: boolean, blocked: boolean, now: number) {
    if (!this.audioGate) return
    let on: boolean
    if (inRange) {
      this.outOfRangeSince.delete(id)
      on = true
    } else if (blocked) {
      on = false
    } else {
      const since = this.outOfRangeSince.get(id) ?? now
      this.outOfRangeSince.set(id, since)
      on = now - since < AUDIO_OFF_DELAY_MS && this.gated.get(id) === true
    }
    if (this.gated.get(id) !== on) {
      this.gated.set(id, on)
      this.audioGate(id, on)
    }
  }

  /** Only wake React when something a person would notice changed. */
  private publish() {
    const key =
      (this.hud.zoneName ?? '') +
      '|' +
      Object.entries(this.hud.hearing)
        .map(([id, g]) => `${id}:${Math.round(g * 20)}`)
        .sort()
        .join(',')
    if (key === this.hudKey) return
    this.hudKey = key
    for (const cb of this.listeners) cb(this.hud)
  }
}

/** A free open-area tile near the map's spawn point, different for each person (so 8 avatars don't stack). */
function pickSpawn(map: WorldMap, seed: string): { col: number; row: number } {
  for (let i = 0; i < 60; i++) {
    const a = hash32(`${seed}:${i}`)
    const col = map.spawn.col + ((a % 7) - 3)
    const row = map.spawn.row + (((a >>> 8) % 7) - 3)
    if (!isTileBlocked(map, col, row) && !zoneAt(map, col + 0.5, row + 0.5)) return { col, row }
  }
  return map.spawn
}
