import type { Socket } from 'socket.io-client'
import { PeerLink } from './PeerLink'
import { parseP2PMessage, type LinkState, type P2PMessage, type SignalData } from './types'

export interface NetworkHandlers {
  onPeerState: (id: string, state: LinkState) => void
  onPeerStream: (id: string, stream: MediaStream) => void
  /** `from` is the authenticated sender of the link, never a field in the payload. */
  onPeerMessage: (from: string, msg: P2PMessage) => void
}

export interface NetworkManagerOptions {
  selfId: string
  socket: Socket
  iceServers: RTCIceServer[]
  chatMax: number
  handlers: NetworkHandlers
}

/**
 * Owns every peer-to-peer connection. The rest of the app never touches
 * RTCPeerConnection: audio goes in/out through setLocalAudioTrack and
 * onPeerStream, text/presence through broadcast/sendTo and onPeerMessage.
 *
 * The signaling socket is used for exactly one thing here: relaying
 * offers/answers/ICE candidates. (Join/leave bookkeeping lives in the store.)
 *
 * Topology: v1 is a full mesh. `shouldLink` is the single place to change when
 * moving to a sparser topology (e.g. chordal ring + relaying).
 */
export class NetworkManager {
  private readonly opts: NetworkManagerOptions
  private readonly links = new Map<string, PeerLink>()
  private localTrack: MediaStreamTrack | null = null
  private muted = true

  constructor(opts: NetworkManagerOptions) {
    this.opts = opts
    opts.socket.on('signal', this.onSignal)
  }

  private readonly onSignal = ({ from, data }: { from: string; data: SignalData }) => {
    // Links are created from the server's peer list / peer:joined, never from a signal.
    this.links.get(from)?.handleSignal(data)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private shouldLink(_peerId: string): boolean {
    return true // full mesh
  }

  /** `initiator`: true when we are the newcomer dialing someone already in the room. */
  connect(peerId: string, initiator: boolean) {
    if (!this.shouldLink(peerId)) return
    this.disconnect(peerId) // a re-joining peer replaces any stale link

    const link = new PeerLink({
      selfId: this.opts.selfId,
      remoteId: peerId,
      initiator,
      iceServers: this.opts.iceServers,
      localAudioTrack: this.localTrack,
      sendSignal: (to, data) => this.opts.socket.emit('signal', { to, data }),
      onState: (s) => this.opts.handlers.onPeerState(peerId, s),
      onStream: (s) => this.opts.handlers.onPeerStream(peerId, s),
      onData: (raw) => {
        const msg = parseP2PMessage(raw, this.opts.chatMax)
        if (msg) this.opts.handlers.onPeerMessage(peerId, msg)
      },
      onOpen: () => link.send(JSON.stringify({ type: 'presence', muted: this.muted })),
    })
    this.links.set(peerId, link)
  }

  disconnect(peerId: string) {
    const link = this.links.get(peerId)
    if (!link) return
    this.links.delete(peerId)
    link.close()
  }

  /** Sends to every connected peer; returns how many it reached. */
  broadcast(msg: P2PMessage): number {
    const raw = JSON.stringify(msg)
    let reached = 0
    for (const link of this.links.values()) if (link.send(raw)) reached++
    return reached
  }

  setPresence(state: { muted: boolean }) {
    this.muted = state.muted
    this.broadcast({ type: 'presence', muted: state.muted })
  }

  /** Swap the microphone track on every link (null = listen only). No renegotiation. */
  setLocalAudioTrack(track: MediaStreamTrack | null) {
    this.localTrack = track
    for (const link of this.links.values()) void link.setAudioTrack(track)
  }

  close() {
    this.opts.socket.off('signal', this.onSignal)
    for (const id of [...this.links.keys()]) this.disconnect(id)
  }
}
