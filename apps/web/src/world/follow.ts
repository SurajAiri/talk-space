/**
 * Following: one person's avatar walks after another's, with the leader's consent.
 *
 * WHO DOES WHAT. Positions, chat and voice are peer-to-peer and the server never sees them, so the server
 * cannot referee this and nothing here touches it. Consent is enforced at BOTH ends instead:
 *
 *   follower ──request──▶ leader      "may I follow you?"
 *   follower ◀──accept─── leader      leader says yes (or `decline`)
 *   either   ───stop────▶ other      "this is over" (also cancels a pending request)
 *
 * The follower's OWN browser walks the follower's avatar (WorldEngine), toward the leader's position as the
 * follower already sees it. Nobody can move somebody else's avatar: the leader only moves himself.
 *
 * Every rule below exists because the peer on the other end may be a modified client:
 *   - An `accept` only counts if we have a request outstanding to that very peer. Otherwise anyone could make
 *     us chase them by sending an unsolicited `accept`. (We answer such a message with `stop`, which also cleans
 *     up a leader whose idea of the state is stale because our request timed out as his accept was in flight.)
 *   - A `request` the leader never answered expires, and each unanswered request is bounded by the room size.
 *   - A decline mutes that person's requests for a while (both sides), so a refused request cannot be repeated.
 *   - Messages carry only a fixed verb, never text, so there is nothing to inject.
 *   - `stop` is always honoured: it can only reduce what we are doing.
 *
 * Consent lives in the leader's `followers` list. MOVING BY HAND only PAUSES following (`paused`), because
 * nudging a key by accident must not cost you a whole new request that the leader has to accept again.
 *
 * Pure logic: no DOM, no sockets. `now` and `send` are injected, so it is unit-tested.
 */

export const FOLLOW_OPS = ['request', 'accept', 'decline', 'stop'] as const
export type FollowOp = (typeof FOLLOW_OPS)[number]

export function isFollowOp(v: unknown): v is FollowOp {
  return typeof v === 'string' && (FOLLOW_OPS as readonly string[]).includes(v)
}

/** How long a request stays open before it lapses on both ends. */
export const REQUEST_TTL_MS = 30_000
/** After a decline: nobody asks again (we do not ask them; theirs are ignored here) for this long. */
export const DECLINE_COOLDOWN_MS = 60_000
/** Quickest you can send one request after another, so the UI cannot spam a person. */
export const REQUEST_GAP_MS = 2_000

/** What the UI and the engine read. A new object every time anything changes, the same one otherwise. */
export interface FollowSnapshot {
  /** the person I am following (they said yes) */
  following: string | null
  /** I moved by hand: still allowed to follow, but not walking after them until I resume */
  paused: boolean
  /** the person I asked and who has not answered yet */
  pending: string | null
  /** people asking to follow ME, waiting for my answer */
  incoming: readonly string[]
  /** people I said yes to */
  followers: readonly string[]
}

export const NO_FOLLOW: FollowSnapshot = { following: null, paused: false, pending: null, incoming: [], followers: [] }

/** Things the UI should tell the person about (the manager does not know names). */
export type FollowEvent =
  | { kind: 'incoming'; from: string }
  | { kind: 'incoming-gone'; from: string }
  | { kind: 'accepted'; by: string }
  | { kind: 'declined'; by: string }
  | { kind: 'timeout'; to: string }
  | { kind: 'lost-leader'; id: string; reason: 'removed' | 'left' }
  | { kind: 'lost-follower'; id: string; reason: 'stopped' | 'left' }

export type RequestResult = 'sent' | 'already' | 'blocked' | 'cooldown' | 'slow-down' | 'unreachable'

export interface FollowOptions {
  /** Deliver a verb to ONE peer. False = there is no open link to them. */
  send: (to: string, op: FollowOp) => boolean
  isBlocked: (id: string) => boolean
  onEvent?: (e: FollowEvent) => void
  now?: () => number
}

export class FollowManager {
  private readonly opts: FollowOptions
  private readonly now: () => number

  private following: string | null = null
  private paused = false
  private pending: { id: string; until: number } | null = null
  private readonly incoming = new Map<string, number>() // id -> when it lapses
  private readonly followers = new Set<string>()
  /** we may not ask this person again until then (they declined us) */
  private readonly askAfter = new Map<string, number>()
  /** their requests are ignored until then (we declined them) */
  private readonly ignoreUntil = new Map<string, number>()
  private lastRequestAt = -Infinity

  private snap: FollowSnapshot = NO_FOLLOW
  private readonly listeners = new Set<() => void>()

  constructor(opts: FollowOptions) {
    this.opts = opts
    this.now = opts.now ?? (() => performance.now())
  }

  // ---------- reading ----------

  get snapshot(): FollowSnapshot {
    return this.snap
  }

  /** `useSyncExternalStore`-shaped: returns the unsubscribe function. */
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  // ---------- what the local person does ----------

  /**
   * Ask `to` if we may follow them. Asking someone else while a request is still open replaces it. Asking
   * while already following someone is fine: the switch only happens once the new person says yes.
   */
  request(to: string): RequestResult {
    if (this.opts.isBlocked(to)) return 'blocked'
    if (this.following === to || this.pending?.id === to) return 'already'
    const now = this.now()
    if ((this.askAfter.get(to) ?? 0) > now) return 'cooldown'
    if (now - this.lastRequestAt < REQUEST_GAP_MS) return 'slow-down'
    const old = this.pending
    if (!this.opts.send(to, 'request')) return 'unreachable' // nothing changed: an older request stays open
    if (old) this.opts.send(old.id, 'stop')
    this.lastRequestAt = now
    this.pending = { id: to, until: now + REQUEST_TTL_MS }
    this.emit()
    return 'sent'
  }

  cancelRequest() {
    const p = this.pending
    if (!p) return
    this.pending = null
    this.opts.send(p.id, 'stop')
    this.emit()
  }

  /** Say yes to someone who asked. False if the request is gone (lapsed, cancelled) or they cannot be reached. */
  accept(from: string): boolean {
    const until = this.incoming.get(from)
    const now = this.now()
    if (until === undefined || until <= now || this.opts.isBlocked(from)) {
      if (this.incoming.delete(from)) this.emit()
      return false
    }
    this.incoming.delete(from)
    if (!this.opts.send(from, 'accept')) {
      this.emit()
      return false
    }
    this.followers.add(from)
    this.emit()
    return true
  }

  decline(from: string) {
    if (!this.incoming.delete(from)) return
    this.ignoreUntil.set(from, this.now() + DECLINE_COOLDOWN_MS)
    this.opts.send(from, 'decline')
    this.emit()
  }

  /** Walking after somebody by hand was interrupted: stay allowed, stop walking. */
  pause() {
    if (!this.following || this.paused) return
    this.paused = true
    this.emit()
  }

  resume() {
    if (!this.following || !this.paused) return
    this.paused = false
    this.emit()
  }

  stopFollowing() {
    const id = this.following
    if (!id) return
    this.following = null
    this.paused = false
    this.opts.send(id, 'stop')
    this.emit()
  }

  /** The leader's side: tell someone they may not follow any more. */
  removeFollower(id: string) {
    if (!this.followers.delete(id)) return
    this.opts.send(id, 'stop')
    this.emit()
  }

  // ---------- what arrives from a peer ----------

  /** `from` is the authenticated sender of the link, never a field in the payload. */
  receive(from: string, op: FollowOp) {
    if (this.opts.isBlocked(from)) return
    const now = this.now()

    if (op === 'request') {
      if ((this.ignoreUntil.get(from) ?? 0) > now) return
      this.followers.delete(from) // they ask again: they lost track of it, so the answer is ours to give again
      const fresh = !this.incoming.has(from)
      this.incoming.set(from, now + REQUEST_TTL_MS)
      if (fresh) this.opts.onEvent?.({ kind: 'incoming', from })
      this.emit()
      return
    }

    if (op === 'accept') {
      if (this.pending?.id !== from) {
        this.opts.send(from, 'stop') // unsolicited, or answered after we gave up: do not let them think we follow
        return
      }
      const previous = this.following
      this.pending = null
      this.following = from
      this.paused = false
      if (previous && previous !== from) this.opts.send(previous, 'stop')
      this.opts.onEvent?.({ kind: 'accepted', by: from })
      this.emit()
      return
    }

    if (op === 'decline') {
      if (this.pending?.id !== from) return
      this.pending = null
      this.askAfter.set(from, now + DECLINE_COOLDOWN_MS)
      this.opts.onEvent?.({ kind: 'declined', by: from })
      this.emit()
      return
    }

    // stop: whatever we had with this person, in either direction, is over
    let changed = false
    if (this.following === from) {
      this.following = null
      this.paused = false
      this.opts.onEvent?.({ kind: 'lost-leader', id: from, reason: 'removed' })
      changed = true
    }
    if (this.followers.delete(from)) {
      this.opts.onEvent?.({ kind: 'lost-follower', id: from, reason: 'stopped' })
      changed = true
    }
    if (this.incoming.delete(from)) {
      this.opts.onEvent?.({ kind: 'incoming-gone', from })
      changed = true
    }
    if (this.pending?.id === from) {
      // a `stop` from someone we asked means no (they may have blocked us): treat it like a decline
      this.pending = null
      this.askAfter.set(from, now + DECLINE_COOLDOWN_MS)
      this.opts.onEvent?.({ kind: 'declined', by: from })
      changed = true
    }
    if (changed) this.emit()
  }

  // ---------- lifecycle ----------

  /** They are gone from the room (no message to send): end everything with them. */
  peerLeft(id: string) {
    let changed = false
    if (this.following === id) {
      this.following = null
      this.paused = false
      this.opts.onEvent?.({ kind: 'lost-leader', id, reason: 'left' })
      changed = true
    }
    if (this.followers.delete(id)) {
      this.opts.onEvent?.({ kind: 'lost-follower', id, reason: 'left' })
      changed = true
    }
    if (this.incoming.delete(id)) {
      this.opts.onEvent?.({ kind: 'incoming-gone', from: id })
      changed = true
    }
    if (this.pending?.id === id) {
      this.pending = null
      changed = true
    }
    if (changed) this.emit()
  }

  /**
   * We blocked them: end everything with them. Blocking is local and unannounced, so the only thing sent is
   * `stop`, which is exactly what removing a follower or giving up following looks like: they cannot tell the two apart,
   * and without it a blocked person's browser would keep chasing us.
   */
  peerBlocked(id: string) {
    let changed = false
    if (this.following === id) {
      this.following = null
      this.paused = false
      changed = true
    }
    if (this.followers.delete(id)) changed = true
    if (this.incoming.delete(id)) {
      this.opts.onEvent?.({ kind: 'incoming-gone', from: id })
      changed = true
    }
    if (this.pending?.id === id) {
      this.pending = null
      changed = true
    }
    if (changed) {
      this.opts.send(id, 'stop')
      this.emit()
    }
  }

  /** Called every so often: lapse requests nobody answered. */
  tick() {
    const now = this.now()
    let changed = false
    if (this.pending && this.pending.until <= now) {
      const to = this.pending.id
      this.pending = null
      this.opts.send(to, 'stop') // lets their prompt go away now instead of when theirs lapses
      this.opts.onEvent?.({ kind: 'timeout', to })
      changed = true
    }
    for (const [id, until] of this.incoming) {
      if (until > now) continue
      this.incoming.delete(id)
      this.opts.onEvent?.({ kind: 'incoming-gone', from: id })
      changed = true
    }
    for (const m of [this.askAfter, this.ignoreUntil]) for (const [id, until] of m) if (until <= now) m.delete(id)
    if (changed) this.emit()
  }

  /** The network changed under us (we joined afresh): nothing we knew about anyone is true any more. */
  reset() {
    const had = this.following || this.pending || this.incoming.size || this.followers.size
    // a prompt on screen for a request that can no longer be answered must go away with it
    for (const from of this.incoming.keys()) this.opts.onEvent?.({ kind: 'incoming-gone', from })
    this.following = null
    this.paused = false
    this.pending = null
    this.incoming.clear()
    this.followers.clear()
    if (had) this.emit()
  }

  private emit() {
    this.snap = {
      following: this.following,
      paused: this.paused,
      pending: this.pending?.id ?? null,
      incoming: [...this.incoming.keys()],
      followers: [...this.followers],
    }
    for (const cb of this.listeners) cb()
  }
}
