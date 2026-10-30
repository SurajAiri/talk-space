import type { LinkState, SignalData } from './types.ts'

export interface PeerLinkOptions {
  selfId: string
  remoteId: string
  /** true for the side that learned about the peer first-hand (the newcomer) */
  initiator: boolean
  iceServers: RTCIceServer[]
  /** 'relay' = only ever use TURN, so the other person never learns our IP address */
  iceTransportPolicy?: RTCIceTransportPolicy
  localAudioTrack: MediaStreamTrack | null
  /** whether our voice flows to this peer right now (see setAudioEnabled) */
  audioEnabled?: boolean
  sendSignal: (to: string, data: SignalData) => void
  onState: (state: LinkState) => void
  onStream: (stream: MediaStream) => void
  onData: (raw: unknown) => void
  onOpen: () => void
  /** the unreliable (position) channel is ready */
  onPosOpen?: () => void
}

/** What NetworkManager needs from a link. Lets tests substitute a fake without a browser. */
export interface Link {
  readonly remoteId: string
  handleSignal(data: SignalData): void
  send(raw: string): boolean
  sendUnreliable(raw: string): boolean
  setLocalTrack(track: MediaStreamTrack | null): Promise<void> | void
  setAudioEnabled(on: boolean): Promise<void> | void
  close(): void
}

const MAX_ICE_RESTARTS = 2
/** How long a link may sit "connecting" before we nudge it (resend the offer / restart ICE). */
const STALL_MS = 12_000
/** After this many nudges that achieved nothing the link is declared failed. */
const MAX_STALL_ROUNDS = 3
/** A dropped-but-not-failed connection usually heals by itself; if not, restart ICE after this long. */
const DISCONNECT_GRACE_MS = 8_000
/** Don't let a slow or stalled peer make us buffer without limit. */
const MAX_BUFFERED_RELIABLE = 256 * 1024
const MAX_BUFFERED_UNRELIABLE = 16 * 1024

/**
 * One RTCPeerConnection to one remote peer: two pre-negotiated data channels
 * (id 0: reliable+ordered for chat/presence; id 1: unordered, no retransmits for
 * positions) and one bidirectional audio transceiver that exists from the
 * start, so muting/unmuting is just replaceTrack() with no renegotiation.
 *
 * Negotiation follows the "perfect negotiation" pattern: if both sides send an
 * offer at once (two people joining at the same instant), the "polite" side
 * (lower user id) rolls back and accepts the other's offer.
 *
 * A watchdog covers the failure the pattern cannot: a signal that never arrived
 * (the other side wasn't listening yet, a server instance restarted). Until the
 * link is connected it periodically re-sends the pending offer or restarts ICE,
 * and finally reports 'failed' so the owner can start over.
 */
export class PeerLink implements Link {
  readonly remoteId: string
  private readonly opts: PeerLinkOptions
  private readonly pc: RTCPeerConnection
  private readonly channel: RTCDataChannel
  private readonly posChannel: RTCDataChannel
  private readonly audio: RTCRtpTransceiver
  private readonly polite: boolean
  private readonly remoteStream = new MediaStream()

  private localTrack: MediaStreamTrack | null
  private audioOn: boolean
  private makingOffer = false
  private ignoreOffer = false
  private hasRemoteDescription = false
  private iceRestarts = 0
  private closed = false
  private gaveUp = false
  private stallRounds = 0
  private watchdog: ReturnType<typeof setTimeout> | null = null
  /** candidates can overtake the offer they belong to; hold them until it is applied */
  private pendingCandidates: RTCIceCandidateInit[] = []
  /** signals are processed strictly one after another (offer before its candidates) */
  private queue: Promise<void> = Promise.resolve()

  constructor(opts: PeerLinkOptions) {
    this.opts = opts
    this.remoteId = opts.remoteId
    this.polite = opts.selfId < opts.remoteId
    this.localTrack = opts.localAudioTrack
    this.audioOn = opts.audioEnabled ?? true

    const pc = new RTCPeerConnection({
      iceServers: opts.iceServers,
      iceTransportPolicy: opts.iceTransportPolicy ?? 'all',
    })
    this.pc = pc

    // Handlers first: some WebRTC implementations fire events synchronously
    // from createDataChannel/addTransceiver; browsers queue them.
    pc.ontrack = ({ track }) => {
      // The remote sender has no MediaStream, so collect tracks in our own.
      if (!this.remoteStream.getTracks().includes(track)) this.remoteStream.addTrack(track)
      opts.onStream(this.remoteStream)
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) opts.sendSignal(this.remoteId, { candidate: candidate.toJSON() })
    }

    pc.onnegotiationneeded = async () => {
      // The responder waits for the initiator's first offer instead of racing it.
      if (!opts.initiator && !this.hasRemoteDescription) return
      await Promise.resolve() // let the constructor finish (see note above)
      if (this.closed) return
      try {
        this.makingOffer = true
        await pc.setLocalDescription()
        this.sendDescription()
      } catch (err) {
        console.warn('[webrtc] negotiation failed', err)
      } finally {
        this.makingOffer = false
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' && this.iceRestarts < MAX_ICE_RESTARTS) {
        this.iceRestarts++
        pc.restartIce()
      }
    }
    pc.onconnectionstatechange = () => this.reportState()

    // Same id on both ends => no ondatachannel dance, safe under offer collisions.
    this.channel = pc.createDataChannel('data', { negotiated: true, id: 0, ordered: true })
    this.channel.onopen = () => opts.onOpen()
    this.channel.onmessage = (e) => opts.onData(e.data)
    // Positions: a stale update is useless, so never retransmit and never wait for order.
    this.posChannel = pc.createDataChannel('pos', {
      negotiated: true,
      id: 1,
      ordered: false,
      maxRetransmits: 0,
    })
    this.posChannel.onopen = () => opts.onPosOpen?.()
    this.posChannel.onmessage = (e) => opts.onData(e.data)

    this.audio = pc.addTransceiver('audio', { direction: 'sendrecv' })
    void this.applyAudio()
    this.armWatchdog(STALL_MS)
    this.reportState()
  }

  /** Feed a signal from the server. Safe to call concurrently; runs in order. */
  handleSignal(data: SignalData) {
    this.queue = this.queue.then(() => this.processSignal(data)).catch((err) => {
      console.warn('[webrtc] signal failed', err)
    })
  }

  send(raw: string): boolean {
    // never queue unboundedly for a peer that is not draining its side
    if (this.channel.readyState !== 'open' || this.channel.bufferedAmount > MAX_BUFFERED_RELIABLE) return false
    this.channel.send(raw)
    return true
  }

  /** Best-effort, may be dropped. Returns false if the channel is not open (or backed up). */
  sendUnreliable(raw: string): boolean {
    if (this.posChannel.readyState !== 'open' || this.posChannel.bufferedAmount > MAX_BUFFERED_UNRELIABLE) {
      return false
    }
    this.posChannel.send(raw)
    return true
  }

  /** The microphone track (null = listen only). No renegotiation. */
  setLocalTrack(track: MediaStreamTrack | null) {
    this.localTrack = track
    return this.applyAudio()
  }

  /**
   * Whether our voice is sent to THIS peer at all. Turning it off stops the audio at the
   * source (replaceTrack(null)), so someone out of earshot costs no upload bandwidth and,
   * with an unmodified client on the other end, cannot hear us. The transceiver stays, so
   * turning it back on needs no renegotiation.
   */
  setAudioEnabled(on: boolean) {
    if (this.audioOn === on) return
    this.audioOn = on
    return this.applyAudio()
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.clearWatchdog()
    this.channel.onopen = this.channel.onmessage = null
    this.posChannel.onopen = this.posChannel.onmessage = null
    this.pc.onnegotiationneeded = this.pc.onicecandidate = this.pc.ontrack = null
    this.pc.onconnectionstatechange = this.pc.oniceconnectionstatechange = null
    this.channel.close()
    this.posChannel.close()
    this.pc.close()
    this.opts.onState('closed')
  }

  private applyAudio(): Promise<void> {
    return this.audio.sender
      .replaceTrack(this.audioOn ? this.localTrack : null)
      .catch((err) => console.warn('[webrtc] replaceTrack failed', err))
  }

  private sendDescription() {
    const d = this.pc.localDescription
    if (!d) return
    this.opts.sendSignal(this.remoteId, {
      description: { type: d.type, sdp: d.sdp },
    })
  }

  private armWatchdog(ms: number) {
    this.clearWatchdog()
    this.watchdog = setTimeout(() => this.onWatchdog(), ms)
  }

  private clearWatchdog() {
    if (this.watchdog) clearTimeout(this.watchdog)
    this.watchdog = null
  }

  private onWatchdog() {
    this.watchdog = null
    if (this.closed || this.pc.connectionState === 'connected') return
    if (++this.stallRounds > MAX_STALL_ROUNDS) {
      this.gaveUp = true
      this.reportState()
      return
    }
    if (this.pc.signalingState === 'have-local-offer') {
      // Our offer may never have reached the other side (it wasn't listening yet). Say it again.
      this.sendDescription()
    } else if (this.opts.initiator || this.hasRemoteDescription) {
      this.pc.restartIce()
    }
    this.armWatchdog(STALL_MS)
  }

  private async processSignal({ description, candidate }: SignalData) {
    if (this.closed) return
    const pc = this.pc

    if (description) {
      const collision =
        description.type === 'offer' && (this.makingOffer || pc.signalingState !== 'stable')
      this.ignoreOffer = !this.polite && collision
      if (this.ignoreOffer) {
        this.pendingCandidates = [] // they belonged to the offer we are ignoring
        return
      }

      await pc.setRemoteDescription(description) // implicit rollback for the polite side
      this.hasRemoteDescription = true
      const pending = this.pendingCandidates
      this.pendingCandidates = []
      for (const c of pending) {
        await pc.addIceCandidate(c).catch((err) => console.warn('[webrtc] late candidate', err))
      }
      if (description.type === 'offer') {
        await pc.setLocalDescription()
        this.sendDescription()
      }
    } else if (candidate) {
      if (!this.hasRemoteDescription) {
        if (!this.ignoreOffer) this.pendingCandidates.push(candidate)
        return
      }
      try {
        await pc.addIceCandidate(candidate)
      } catch (err) {
        if (!this.ignoreOffer) throw err
      }
    }
  }

  private reportState() {
    if (this.closed) return
    const s = this.pc.connectionState
    if (s === 'connected') {
      this.gaveUp = false
      this.stallRounds = 0
      this.clearWatchdog()
      this.opts.onState('connected')
    } else if (this.gaveUp) {
      this.opts.onState('failed')
    } else if (s === 'disconnected') {
      // often heals on its own; if it does not, restart ICE instead of waiting forever
      if (!this.watchdog) this.armWatchdog(DISCONNECT_GRACE_MS)
      this.opts.onState('unstable')
    } else if (s === 'failed') {
      this.opts.onState(this.iceRestarts < MAX_ICE_RESTARTS ? 'connecting' : 'failed')
    } else if (s === 'closed') this.opts.onState('closed')
    else this.opts.onState('connecting')
  }
}
