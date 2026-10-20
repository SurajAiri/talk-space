import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { create } from 'zustand'
import { connectSocket, disconnectSocket } from '../lib/socket'
import { loadRoomConfig, type RoomView } from '../lib/rooms'
import { NetworkManager } from '../webrtc/NetworkManager'
import type { LinkState, P2PMessage, PeerInfo } from '../webrtc/types'

export type RoomStatus = 'idle' | 'joining' | 'joined' | 'reconnecting' | 'ended'
export type MicState = 'off' | 'on' | 'denied' | 'unsupported' | 'unavailable'

export interface PeerView extends PeerInfo {
  link: LinkState
  muted: boolean
  stream: MediaStream | null
}

export interface ChatMessage {
  id: string
  fromId: string
  fromName: string
  text: string
  ts: number
  self: boolean
}

interface JoinAck {
  ok: true
  room: RoomView
  self: PeerInfo
  peers: PeerInfo[]
  iceServers: RTCIceServer[]
}
type JoinFailure = { ok: false; code: string; message: string }
export type JoinResult = { ok: true } | JoinFailure

interface RoomState {
  status: RoomStatus
  room: RoomView | null
  selfId: string | null
  peers: Record<string, PeerView>
  messages: ChatMessage[]
  mic: MicState
  muted: boolean
  /** why the session ended (kicked, failed to re-join, ...) */
  endedReason: string | null

  join: (roomId: string, opts: { joinCode?: string; withMic: boolean }) => Promise<JoinResult>
  leave: () => Promise<void>
  sendChat: (text: string) => boolean
  enableMic: () => Promise<void>
  toggleMute: () => void
}

const initial = {
  status: 'idle' as RoomStatus,
  room: null,
  selfId: null,
  peers: {} as Record<string, PeerView>,
  messages: [] as ChatMessage[],
  mic: 'off' as MicState,
  muted: true,
  endedReason: null,
}

type MicResult =
  | { track: MediaStreamTrack; error: null; detail?: undefined }
  | { track: null; error: Exclude<MicState, 'off' | 'on'>; detail?: string }

async function acquireMic(): Promise<MicResult> {
  // Browsers only expose the microphone on HTTPS or localhost. Over plain
  // http://<lan-ip> mediaDevices is undefined and no permission prompt exists.
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return { track: null, error: 'unsupported' }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    })
    const track = stream.getAudioTracks()[0]
    return track ? { track, error: null } : { track: null, error: 'unavailable' }
  } catch (err) {
    const name = err instanceof DOMException ? err.name : 'Error'
    const detail = `${name}${err instanceof Error && err.message ? `: ${err.message}` : ''}`
    return {
      track: null,
      error: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable',
      detail,
    }
  }
}

/** Tells the person exactly why the microphone isn't working (and logs the raw error). */
function toastMicError(error: Exclude<MicState, 'off' | 'on'>, detail?: string) {
  const where = `${window.location.protocol}//${window.location.host}`
  const messages = {
    unsupported: `Microphone needs a secure page. This page is ${where} (secure context: ${String(window.isSecureContext)}). Use https:// or localhost.`,
    denied: `Microphone permission was denied${detail ? ` (${detail})` : ''}. Allow it in Chrome: tap the icon left of the address bar, Permissions, Microphone.`,
    unavailable: `No usable microphone${detail ? ` (${detail})` : ''}. Another app may be using it.`,
  }
  console.warn('[mic]', error, detail, where)
  toast.error(messages[error], { duration: 12000 })
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`

function emitJoin(
  socket: Socket,
  payload: { roomId: string; joinCode?: string },
): Promise<JoinAck | JoinFailure> {
  return new Promise((resolve) => {
    socket
      .timeout(10_000)
      .emit('room:join', payload, (err: Error | null, ack: JoinAck | JoinFailure) => {
        resolve(err ? { ok: false, code: 'TIMEOUT', message: 'The server did not respond.' } : ack)
      })
  })
}

export const useRoomStore = create<RoomState>()((set, get) => {
  // Live objects that don't belong in React state.
  let socket: Socket | null = null
  let manager: NetworkManager | null = null
  let localTrack: MediaStreamTrack | null = null
  let joinParams: { roomId: string; joinCode?: string } | null = null
  let chatMax = 2000
  /** bumped on every join/leave so late async results from an old attempt are dropped */
  let generation = 0

  const updatePeer = (id: string, patch: Partial<PeerView>) =>
    set((s) => (s.peers[id] ? { peers: { ...s.peers, [id]: { ...s.peers[id], ...patch } } } : s))

  const addPeer = (p: PeerInfo) =>
    set((s) => ({
      peers: { ...s.peers, [p.id]: { ...p, link: 'connecting', muted: true, stream: null } },
    }))

  const removePeer = (id: string) =>
    set((s) => {
      const rest = { ...s.peers }
      delete rest[id]
      return { peers: rest }
    })

  function stopMic() {
    localTrack?.stop()
    localTrack = null
  }

  function teardown() {
    generation++
    manager?.close()
    manager = null
    stopMic()
    disconnectSocket()
    socket = null
    joinParams = null
  }

  function endSession(reason: string) {
    teardown()
    set({ status: 'ended', endedReason: reason, peers: {}, mic: 'off', muted: true })
  }

  function startNetwork(ack: JoinAck) {
    manager?.close()
    const mgr = new NetworkManager({
      selfId: ack.self.id,
      socket: socket!,
      iceServers: ack.iceServers,
      chatMax,
      handlers: {
        onPeerState: (id, link) => updatePeer(id, { link }),
        onPeerStream: (id, stream) => updatePeer(id, { stream }),
        onPeerMessage: (from, msg) => handlePeerMessage(from, msg),
      },
    })
    manager = mgr
    mgr.setLocalAudioTrack(localTrack)
    mgr.setPresence({ muted: get().muted })

    const peers: Record<string, PeerView> = {}
    for (const p of ack.peers) peers[p.id] = { ...p, link: 'connecting', muted: true, stream: null }
    set({ status: 'joined', room: ack.room, selfId: ack.self.id, peers })

    // We are the newcomer: we dial everyone already inside.
    for (const p of ack.peers) mgr.connect(p.id, true)
  }

  function handlePeerMessage(from: string, msg: P2PMessage) {
    if (msg.type === 'presence') return updatePeer(from, { muted: msg.muted })
    const peer = get().peers[from]
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: msg.id,
          fromId: from,
          fromName: peer?.name ?? 'Unknown',
          text: msg.text,
          ts: msg.ts,
          self: false,
        },
      ].slice(-500),
    }))
  }

  function attachSocketListeners(s: Socket) {
    s.on('peer:joined', (peer: PeerInfo) => {
      if (get().status !== 'joined') return
      addPeer(peer)
      manager?.connect(peer.id, false) // they will dial us
    })

    s.on('peer:left', ({ userId }: { userId: string }) => {
      manager?.disconnect(userId)
      removePeer(userId)
    })

    s.on('room:replaced', () => {
      endSession('You joined this room from another tab, so this session was closed.')
    })

    s.on('disconnect', (reason: string) => {
      if (reason === 'io client disconnect') return
      // The server drops our seat when the socket dies; links to peers are
      // useless now. socket.io reconnects on its own and we re-join below.
      if (get().status === 'joined') {
        manager?.close()
        manager = null
        set({ status: 'reconnecting', peers: {} })
      }
    })

    s.on('connect', async () => {
      if (get().status !== 'reconnecting' || !joinParams) return
      const gen = generation
      const ack = await emitJoin(s, joinParams)
      if (gen !== generation) return
      if (ack.ok) startNetwork(ack)
      else endSession(`Couldn't rejoin the room: ${ack.message}`)
    })
  }

  return {
    ...initial,

    join: async (roomId, { joinCode, withMic }) => {
      if (get().status !== 'idle') {
        return { ok: false, code: 'BUSY', message: 'You are already in a room.' }
      }
      const gen = ++generation
      set({ ...initial, status: 'joining' })
      const fail = (f: JoinFailure): JoinFailure => {
        if (gen === generation) {
          teardown()
          set({ ...initial })
        }
        return f
      }

      try {
        chatMax = (await loadRoomConfig()).chatMessageMax
      } catch {
        /* keep default */
      }

      let micError: MicState = 'off'
      if (withMic) {
        const res = await acquireMic()
        localTrack = res.track
        if (res.error) {
          micError = res.error
          toastMicError(res.error, res.detail)
        }
      }
      if (gen !== generation) {
        stopMic()
        return { ok: false, code: 'CANCELLED', message: 'Cancelled.' }
      }

      try {
        socket = await connectSocket()
      } catch (err) {
        const code = err instanceof Error ? err.message : ''
        return fail({
          ok: false,
          code: 'CONNECTION',
          message: code.startsWith('ACCOUNT_')
            ? 'Your account cannot join rooms right now.'
            : 'Could not reach the server. Check your connection and try again.',
        })
      }
      if (gen !== generation) return { ok: false, code: 'CANCELLED', message: 'Cancelled.' }

      attachSocketListeners(socket)
      joinParams = { roomId, joinCode }
      const ack = await emitJoin(socket, joinParams)
      if (gen !== generation) return { ok: false, code: 'CANCELLED', message: 'Cancelled.' }
      if (!ack.ok) return fail(ack)

      set({
        mic: localTrack ? 'on' : micError,
        muted: !localTrack,
      })
      startNetwork(ack)
      return { ok: true }
    },

    leave: async () => {
      const s = socket
      if (s?.connected && get().status === 'joined') {
        // explicit leave: an empty room is deleted immediately
        await new Promise<void>((resolve) => s.timeout(2000).emit('room:leave', () => resolve()))
      }
      teardown()
      set({ ...initial })
    },

    sendChat: (text) => {
      const trimmed = text.trim()
      const { selfId, status } = get()
      if (!trimmed || trimmed.length > chatMax || status !== 'joined' || !selfId) return false

      const msg = { type: 'chat' as const, id: newId(), text: trimmed, ts: Date.now() }
      manager?.broadcast(msg)
      set((s) => ({
        messages: [
          ...s.messages,
          { id: msg.id, fromId: selfId, fromName: 'You', text: trimmed, ts: msg.ts, self: true },
        ].slice(-500),
      }))
      return true
    },

    enableMic: async () => {
      if (localTrack || get().status !== 'joined') return
      const res = await acquireMic()
      if (!res.track) {
        toastMicError(res.error, res.detail)
        return set({ mic: res.error })
      }
      localTrack = res.track
      manager?.setLocalAudioTrack(res.track)
      manager?.setPresence({ muted: false })
      set({ mic: 'on', muted: false })
    },

    toggleMute: () => {
      if (!localTrack) return void get().enableMic()
      localTrack.enabled = !localTrack.enabled
      const muted = !localTrack.enabled
      manager?.setPresence({ muted })
      set({ muted })
    },
  }
})
