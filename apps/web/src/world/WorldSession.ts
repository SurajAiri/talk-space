import type { PosMessage } from '../webrtc/types'
import { hearingGain, zoneAt } from './hearing'
import { isTileBlocked } from './navigation'
import { ProximityMixer } from './ProximityMixer'
import { hash32 } from './appearance'
import { MAP_COLS, MAP_ROWS, type Dir, type WorldMap } from './types'

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

const round2 = (n: number) => Math.round(n * 100) / 100

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

  private send: ((msg: PosMessage) => void) | null = null
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
  attach(send: (msg: PosMessage) => void) {
    this.send = send
    this.lastSent = null // force an immediate broadcast to the new peers
    this.clearRemotes()
  }

  /** Network is gone (reconnecting). Peers are unknown until we re-join. */
  detach() {
    this.send = null
    this.clearRemotes()
  }

  clearRemotes() {
    this.remotes.clear()
    this.mixer.detachAll()
    this.publish()
  }

  onRemotePosition(id: string, msg: PosMessage) {
    // Untrusted input: keep it inside the map no matter what the peer claims.
    this.remotes.set(id, {
      x: Math.min(Math.max(msg.x, 0), MAP_COLS - 0.01),
      y: Math.min(Math.max(msg.y, 0), MAP_ROWS - 0.01),
      dir: msg.dir,
      moving: msg.moving,
    })
  }

  onPeerStream(id: string, stream: MediaStream) {
    this.mixer.attach(id, stream)
    this.updateHearing() // set the right volume now, not 100 ms from now
  }

  onPeerLeft(id: string) {
    this.remotes.delete(id)
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
    for (const [id, remote] of this.remotes) {
      const g = hearingGain(this.map, this.local, remote)
      hearing[id] = g
      this.mixer.setGain(id, g)
    }
    this.hud = { zoneName: zoneAt(this.map, this.local.x, this.local.y)?.name ?? null, hearing }
    this.publish()
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
