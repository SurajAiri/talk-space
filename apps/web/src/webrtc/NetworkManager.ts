import type { Socket } from 'socket.io-client'
import { PeerLink, type Link, type PeerLinkOptions } from './PeerLink.ts'
import { TokenBucket, WindowCounter } from './RateLimiter.ts'
import { parseP2PMessage, type LinkState, type P2PMessage, type PosMessage, type SignalData } from './types.ts'

export type AbuseReason = 'flooding' | 'garbage'

export interface NetworkHandlers {
  onPeerState: (id: string, state: LinkState) => void
  onPeerStream: (id: string, stream: MediaStream) => void
  /** `from` is the authenticated sender of the link, never a field in the payload. */
  onPeerMessage: (from: string, msg: P2PMessage) => void
  /** A peer keeps sending far more than any honest client would. The owner decides what to do (we suggest: mute them). */
  onPeerAbuse?: (id: string, reason: AbuseReason) => void
}

export interface NetworkManagerOptions {
  selfId: string
  socket: Pick<Socket, 'on' | 'off' | 'emit'>
  iceServers: RTCIceServer[]
  /** 'relay' hides our IP address from the other participants (needs a TURN server) */
  iceTransportPolicy?: RTCIceTransportPolicy
  chatMax: number
  /**
   * Whether our voice starts out flowing to a newly connected peer. A room with a world sets
   * this to false: voice then only flows to people the hearing rules say can hear us.
   */
  audioDefault?: boolean
  handlers: NetworkHandlers
  /** tests substitute a fake link; production uses PeerLink */
  linkFactory?: (opts: PeerLinkOptions) => Link
  now?: () => number
}

/** Per-peer budgets for what a remote peer may make us process. Honest clients stay far below these. */
const LIMITS = {
  /** every message, parsed or not: the cheapest possible check, done first */
  any: { capacity: 120, perSecond: 80 },
  chat: { capacity: 8, perSecond: 2 },
  pos: { capacity: 40, perSecond: 25 },
  presence: { capacity: 10, perSecond: 2 },
} as const
/** More than this many dropped/invalid messages inside the window and the peer is reported as abusive. */
const ABUSE_DROPS = 150
const ABUSE_WINDOW_MS = 10_000
const ABUSE_REPORT_COOLDOWN_MS = 30_000

/** Signals that arrive before we know the peer yet are kept briefly instead of being lost. */
const SIGNAL_BUFFER_MAX_PER_PEER = 64
const SIGNAL_BUFFER_MAX_PEERS = 16
const SIGNAL_BUFFER_TTL_MS = 10_000

/** After a link fails for good: how many times to start over, and how long to wait the first time (doubles). */
const MAX_REDIALS = 3
const REDIAL_BASE_MS = 1_000

interface PeerBudget {
  any: TokenBucket
  chat: TokenBucket
  pos: TokenBucket
  presence: TokenBucket
  drops: WindowCounter
  lastAbuseReport: number
}

/**
 * Owns every peer-to-peer connection. The rest of the app never touches
 * RTCPeerConnection: audio goes in/out through setLocalAudioTrack and
 * onPeerStream, text/presence through broadcast and onPeerMessage.
 *
 * The signaling socket is used for exactly one thing here: relaying the
 * connection handshake (offers/answers/ICE candidates, plus "start over").
 * Chat, voice and positions never touch the server.
 *
 * Everything a peer sends is untrusted: it is rate limited per peer before it is
 * parsed, validated after, and a peer that floods is reported to the owner.
 *
 * Topology: v1 is a full mesh. `shouldLink` is the single place to change when
 * moving to a sparser topology (e.g. chordal ring + relaying).
 */
export class NetworkManager {
  private readonly opts: NetworkManagerOptions
  private readonly now: () => number
  private readonly links = new Map<string, Link>()
  private readonly budgets = new Map<string, PeerBudget>()
  private readonly blocked = new Set<string>()
  /** world-driven: false = this peer is out of earshot, don't send them our voice */
  private readonly audioWanted = new Map<string, boolean>()
  private readonly signalBuffer = new Map<string, { at: number; data: SignalData }[]>()
  private readonly redials = new Map<string, { count: number; timer: ReturnType<typeof setTimeout> | null }>()
  private localTrack: MediaStreamTrack | null = null
  private muted = true
  private closed = false
  /** latest position, replayed to links that open later so newcomers see us immediately */
  private lastPos: string | null = null

  constructor(opts: NetworkManagerOptions) {
    this.opts = opts
    this.now = opts.now ?? (() => performance.now())
    opts.socket.on('signal', this.onSignal)
  }

  private readonly onSignal = ({ from, data }: { from: string; data: SignalData }) => {
    if (this.closed) return
    if (data.reset) {
      // The peer gave up on the old link and is starting over; so do we. Roles are fixed by
      // id so both sides agree on who sends the first offer. (Never answer with another reset:
      // that is how two peers would ping-pong forever.)
      if (this.links.has(from)) this.relink(from, false)
      return
    }
    const link = this.links.get(from)
    if (link) return link.handleSignal(data)
    this.bufferSignal(from, data)
  }

  private bufferSignal(from: string, data: SignalData) {
    const t = this.now()
    // forget stale entries first so a flood of strangers can't fill the buffer
    for (const [id, list] of this.signalBuffer) {
      const fresh = list.filter((e) => t - e.at < SIGNAL_BUFFER_TTL_MS)
      if (fresh.length) this.signalBuffer.set(id, fresh)
      else this.signalBuffer.delete(id)
    }
    let list = this.signalBuffer.get(from)
    if (!list) {
      if (this.signalBuffer.size >= SIGNAL_BUFFER_MAX_PEERS) return
      list = []
      this.signalBuffer.set(from, list)
    }
    if (list.length < SIGNAL_BUFFER_MAX_PER_PEER) list.push({ at: t, data })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private shouldLink(_peerId: string): boolean {
    return true // full mesh
  }

  private budgetFor(peerId: string): PeerBudget {
    let b = this.budgets.get(peerId)
    if (!b) {
      const mk = (l: { capacity: number; perSecond: number }) => new TokenBucket(l.capacity, l.perSecond, this.now)
      b = {
        any: mk(LIMITS.any),
        chat: mk(LIMITS.chat),
        pos: mk(LIMITS.pos),
        presence: mk(LIMITS.presence),
        drops: new WindowCounter(ABUSE_WINDOW_MS, this.now),
        lastAbuseReport: -Infinity,
      }
      this.budgets.set(peerId, b)
    }
    return b
  }

  private drop(peerId: string, reason: AbuseReason) {
    const b = this.budgetFor(peerId)
    if (b.drops.hit() < ABUSE_DROPS) return
    const t = this.now()
    if (t - b.lastAbuseReport < ABUSE_REPORT_COOLDOWN_MS) return
    b.lastAbuseReport = t
    this.opts.handlers.onPeerAbuse?.(peerId, reason)
  }

  /** Everything arriving from a peer goes through here. */
  private receive(peerId: string, raw: unknown) {
    if (this.blocked.has(peerId)) return
    const b = this.budgetFor(peerId)
    if (!b.any.take()) return this.drop(peerId, 'flooding')

    const msg = parseP2PMessage(raw, this.opts.chatMax)
    if (!msg) return this.drop(peerId, 'garbage')

    const bucket = msg.type === 'chat' ? b.chat : msg.type === 'pos' ? b.pos : b.presence
    if (!bucket.take()) return this.drop(peerId, 'flooding')
    this.opts.handlers.onPeerMessage(peerId, msg)
  }

  private effectiveAudio(peerId: string) {
    return !this.blocked.has(peerId) && (this.audioWanted.get(peerId) ?? this.opts.audioDefault ?? true)
  }

  /** `initiator`: true when we are the newcomer dialing someone already in the room. */
  connect(peerId: string, initiator: boolean) {
    if (this.closed || !this.shouldLink(peerId)) return
    // a re-joining peer replaces any stale link. Signals already buffered for it are NOT
    // dropped: they are the new link's first offer arriving a moment before we knew about it.
    this.dropLink(peerId)
    this.redials.set(peerId, { count: 0, timer: null })
    this.createLink(peerId, initiator)
  }

  private createLink(peerId: string, initiator: boolean) {
    const holder: { link?: Link } = {}
    // events from a link that has since been replaced must not touch the new one
    const current = () => holder.link === undefined || this.links.get(peerId) === holder.link

    const factory = this.opts.linkFactory ?? ((o: PeerLinkOptions) => new PeerLink(o))
    const link = factory({
      selfId: this.opts.selfId,
      remoteId: peerId,
      initiator,
      iceServers: this.opts.iceServers,
      iceTransportPolicy: this.opts.iceTransportPolicy,
      localAudioTrack: this.localTrack,
      audioEnabled: this.effectiveAudio(peerId),
      sendSignal: (to, data) => this.opts.socket.emit('signal', { to, data }),
      onState: (s) => {
        if (!current()) return
        this.opts.handlers.onPeerState(peerId, s)
        if (s === 'connected') this.redials.set(peerId, { count: 0, timer: null })
        if (s === 'failed') this.scheduleRedial(peerId)
      },
      onStream: (s) => current() && this.opts.handlers.onPeerStream(peerId, s),
      onData: (raw) => current() && this.receive(peerId, raw),
      onOpen: () => {
        if (current()) link.send(JSON.stringify({ type: 'presence', muted: this.muted }))
      },
      onPosOpen: () => {
        if (current() && this.lastPos) link.sendUnreliable(this.lastPos)
      },
    })
    holder.link = link
    this.links.set(peerId, link)

    // hand over anything that arrived before the link existed
    const buffered = this.signalBuffer.get(peerId)
    if (buffered) {
      this.signalBuffer.delete(peerId)
      const t = this.now()
      for (const e of buffered) if (t - e.at < SIGNAL_BUFFER_TTL_MS) link.handleSignal(e.data)
    }
  }

  /** Drop the link and build a new one. Roles are decided by id so the two sides never both wait for an offer. */
  private relink(peerId: string, tellPeer: boolean) {
    const old = this.links.get(peerId)
    if (!old) return
    this.links.delete(peerId)
    old.close()
    this.createLink(peerId, this.opts.selfId < peerId)
    if (tellPeer) this.opts.socket.emit('signal', { to: peerId, data: { reset: true } })
  }

  /** A link failed for good (not just slow): start over a few times, backing off. */
  private scheduleRedial(peerId: string) {
    if (this.closed) return
    const state = this.redials.get(peerId) ?? { count: 0, timer: null }
    if (state.timer || state.count >= MAX_REDIALS) return
    state.timer = setTimeout(() => {
      state.timer = null
      if (this.closed || !this.links.has(peerId)) return
      state.count++
      this.relink(peerId, true)
    }, REDIAL_BASE_MS * 2 ** state.count)
    this.redials.set(peerId, state)
  }

  /**
   * After the signaling socket reconnected: the server says who is in the room NOW. Keep the
   * links that are alive (that is the point: a blip on the signaling server should not cut
   * anyone's voice), dial the people we have no link to, drop links to people who are gone.
   */
  reconcile(peerIds: string[]) {
    const present = new Set(peerIds)
    for (const id of [...this.links.keys()]) if (!present.has(id)) this.disconnect(id)
    for (const id of present) if (!this.links.has(id)) this.connect(id, true)
  }

  hasLink(peerId: string) {
    return this.links.has(peerId)
  }

  /** Closes the link and forgets per-link state (but not signals waiting for the next link). */
  private dropLink(peerId: string) {
    const redial = this.redials.get(peerId)
    if (redial?.timer) clearTimeout(redial.timer)
    this.redials.delete(peerId)
    this.budgets.delete(peerId)
    this.audioWanted.delete(peerId)
    const link = this.links.get(peerId)
    if (!link) return
    this.links.delete(peerId)
    link.close()
  }

  /** The peer is gone: close the link and forget everything about them. */
  disconnect(peerId: string) {
    this.dropLink(peerId)
    this.signalBuffer.delete(peerId)
  }

  /**
   * Ignore a person: their messages and voice are dropped here, and nothing of ours (chat, voice)
   * is sent to them. Purely local: the other person is not told, and nothing goes to the server.
   */
  setBlocked(peerId: string, blocked: boolean) {
    if (blocked) this.blocked.add(peerId)
    else this.blocked.delete(peerId)
    void this.links.get(peerId)?.setAudioEnabled(this.effectiveAudio(peerId))
  }

  isBlocked(peerId: string) {
    return this.blocked.has(peerId)
  }

  /** The world says whether this peer can hear us right now; if not, we stop sending them our voice. */
  setPeerAudio(peerId: string, wanted: boolean) {
    this.audioWanted.set(peerId, wanted)
    void this.links.get(peerId)?.setAudioEnabled(this.effectiveAudio(peerId))
  }

  /** Sends to every connected peer (except blocked ones); returns how many it reached. */
  broadcast(msg: P2PMessage): number {
    const raw = JSON.stringify(msg)
    const sendable = msg.type !== 'chat' // blocked people get no chat from us, but do see presence
    let reached = 0
    for (const [id, link] of this.links) {
      if (!sendable && this.blocked.has(id)) continue
      if (link.send(raw)) reached++
    }
    return reached
  }

  /** Best-effort position broadcast on the unreliable channel; returns how many peers it reached. */
  sendPosition(msg: PosMessage): number {
    const raw = JSON.stringify(msg)
    this.lastPos = raw
    let reached = 0
    for (const link of this.links.values()) if (link.sendUnreliable(raw)) reached++
    return reached
  }

  setPresence(state: { muted: boolean }) {
    this.muted = state.muted
    this.broadcast({ type: 'presence', muted: state.muted })
  }

  /** Swap the microphone track on every link (null = listen only). No renegotiation. */
  setLocalAudioTrack(track: MediaStreamTrack | null) {
    this.localTrack = track
    for (const link of this.links.values()) void link.setLocalTrack(track)
  }

  close() {
    this.closed = true
    this.opts.socket.off('signal', this.onSignal)
    for (const id of [...this.links.keys()]) this.disconnect(id)
    this.signalBuffer.clear()
  }
}
