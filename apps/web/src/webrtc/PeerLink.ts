import type { LinkState, SignalData } from './types'

export interface PeerLinkOptions {
  selfId: string
  remoteId: string
  /** true for the side that learned about the peer first-hand (the newcomer) */
  initiator: boolean
  iceServers: RTCIceServer[]
  localAudioTrack: MediaStreamTrack | null
  sendSignal: (to: string, data: SignalData) => void
  onState: (state: LinkState) => void
  onStream: (stream: MediaStream) => void
  onData: (raw: unknown) => void
  onOpen: () => void
}

const MAX_ICE_RESTARTS = 2

/**
 * One RTCPeerConnection to one remote peer: a pre-negotiated data channel
 * (chat/presence) and one bidirectional audio transceiver that exists from the
 * start, so muting/unmuting is just replaceTrack() with no renegotiation.
 *
 * Negotiation follows the "perfect negotiation" pattern: if both sides send an
 * offer at once (two people joining at the same instant), the "polite" side
 * (lower user id) rolls back and accepts the other's offer.
 */
export class PeerLink {
  readonly remoteId: string
  private readonly opts: PeerLinkOptions
  private readonly pc: RTCPeerConnection
  private readonly channel: RTCDataChannel
  private readonly audio: RTCRtpTransceiver
  private readonly polite: boolean
  private readonly remoteStream = new MediaStream()

  private makingOffer = false
  private ignoreOffer = false
  private hasRemoteDescription = false
  private iceRestarts = 0
  private closed = false
  /** candidates can overtake the offer they belong to; hold them until it is applied */
  private pendingCandidates: RTCIceCandidateInit[] = []
  /** signals are processed strictly one after another (offer before its candidates) */
  private queue: Promise<void> = Promise.resolve()

  constructor(opts: PeerLinkOptions) {
    this.opts = opts
    this.remoteId = opts.remoteId
    this.polite = opts.selfId < opts.remoteId

    const pc = new RTCPeerConnection({ iceServers: opts.iceServers })
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

    this.audio = pc.addTransceiver('audio', { direction: 'sendrecv' })
    if (opts.localAudioTrack) void this.audio.sender.replaceTrack(opts.localAudioTrack)
    this.reportState()
  }

  /** Feed a signal from the server. Safe to call concurrently; runs in order. */
  handleSignal(data: SignalData) {
    this.queue = this.queue.then(() => this.processSignal(data)).catch((err) => {
      console.warn('[webrtc] signal failed', err)
    })
  }

  send(raw: string): boolean {
    if (this.channel.readyState !== 'open') return false
    this.channel.send(raw)
    return true
  }

  setAudioTrack(track: MediaStreamTrack | null) {
    return this.audio.sender.replaceTrack(track)
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.channel.onopen = this.channel.onmessage = null
    this.pc.onnegotiationneeded = this.pc.onicecandidate = this.pc.ontrack = null
    this.pc.onconnectionstatechange = this.pc.oniceconnectionstatechange = null
    this.channel.close()
    this.pc.close()
    this.opts.onState('closed')
  }

  private sendDescription() {
    const d = this.pc.localDescription
    if (!d) return
    this.opts.sendSignal(this.remoteId, {
      description: { type: d.type, sdp: d.sdp },
    })
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
    if (s === 'connected') this.opts.onState('connected')
    else if (s === 'disconnected') this.opts.onState('unstable')
    else if (s === 'failed') {
      this.opts.onState(this.iceRestarts < MAX_ICE_RESTARTS ? 'connecting' : 'failed')
    } else if (s === 'closed') this.opts.onState('closed')
    else this.opts.onState('connecting')
  }
}
