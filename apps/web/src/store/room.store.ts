import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { create } from 'zustand'
import { connectSocket, disconnectSocket } from '../lib/socket'
import { loadBlocked, saveBlocked } from '../lib/blocklist'
import { loadRoomConfig, reportsApi, type RoomView } from '../lib/rooms'
import { NetworkManager } from '../webrtc/NetworkManager'
import { TokenBucket } from '../webrtc/RateLimiter'
import { loadWorldMap } from '../world/maps'
import { WorldSession } from '../world/WorldSession'
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
  /** when WE received it: a peer's own clock is not trusted for ordering */
  ts: number
  self: boolean
}

interface JoinAck {
  ok: true
  room: RoomView
  self: PeerInfo
  peers: PeerInfo[]
  iceServers: RTCIceServer[]
  iceTransportPolicy: 'all' | 'relay'
  relayAvailable: boolean
  resumed: boolean
}
type JoinFailure = { ok: false; code: string; message: string }
export type JoinResult = { ok: true } | JoinFailure

export type ReportResult = { ok: true } | { ok: false; message: string }

interface RoomState {
  status: RoomStatus
  room: RoomView | null
  selfId: string | null
  peers: Record<string, PeerView>
  messages: ChatMessage[]
  mic: MicState
  muted: boolean
  /** The room's 2D world (positions + proximity audio). null for rooms without a map. */
  world: WorldSession | null
  /** why the session ended (kicked, failed to re-join, ...) */
  endedReason: string | null
  /** people this browser ignores (see lib/blocklist) */
  blocked: Record<string, true>
  /** every connection goes through the TURN relay, so other participants never see our IP */
  relayOnly: boolean

  join: (
    roomId: string,
    opts: { joinCode?: string; withMic: boolean; hideIp?: boolean },
  ) => Promise<JoinResult>
  leave: () => Promise<void>
  sendChat: (text: string) => 'sent' | 'invalid' | 'slow-down'
  enableMic: () => Promise<void>
  toggleMute: () => void
  blockPeer: (id: string) => void
  unblockPeer: (id: string) => void
  /** host only: remove someone from the room (the server enforces that you are the host) */
  kickPeer: (id: string) => Promise<{ ok: boolean; message?: string }>
  reportPeer: (id: string, reason: string, details?: string) => Promise<ReportResult>
}

const initial = {
  status: 'idle' as RoomStatus,
  room: null,
  selfId: null,
  peers: {} as Record<string, PeerView>,
  messages: [] as ChatMessage[],
  mic: 'off' as MicState,
  muted: true,
  world: null as WorldSession | null,
  endedReason: null,
  relayOnly: false,
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

/**
 * Invented once per page load. The server uses it to tell "this same tab reconnecting after a
 * network blip" (everyone's peer-to-peer links are still fine) from "a reload or a second tab".
 */
const SESSION_ID = newId().replace(/[^A-Za-z0-9_-]/g, '')

function emitJoin(
  socket: Socket,
  payload: { roomId: string; joinCode?: string },
): Promise<JoinAck | JoinFailure> {
  return new Promise((resolve) => {
    socket
      .timeout(10_000)
      .emit(
        'room:join',
        { ...payload, sessionId: SESSION_ID },
        (err: Error | null, ack: JoinAck | JoinFailure) => {
          resolve(err ? { ok: false, code: 'TIMEOUT', message: 'The server did not respond.' } : ack)
        },
      )
  })
}

const MAX_MESSAGES = 500
const MAX_SEEN_IDS = 2000

export const useRoomStore = create<RoomState>()((set, get) => {
  // Live objects that don't belong in React state.
  let socket: Socket | null = null
  let manager: NetworkManager | null = null
  let localTrack: MediaStreamTrack | null = null
  let joinParams: { roomId: string; joinCode?: string } | null = null
  let world: WorldSession | null = null
  let chatMax = 2000
  let hideIpChoice = false
  /** bumped on every join/leave so late async results from an old attempt are dropped */
  let generation = 0
  const blockedIds = loadBlocked()
  /** `${peerId}:${messageId}` of everything shown, so a peer can't make a message appear twice */
  const seen = new Set<string>()
  /** at most a short burst, then ~1 message a second: our own UI can't be what floods the room */
  let chatBucket = new TokenBucket(5, 1)

  const blockedRecord = () => Object.fromEntries([...blockedIds].map((id) => [id, true as const]))

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
    world?.close() // stops its timer and every peer's audio
    world = null
    stopMic()
    disconnectSocket()
    socket = null
    joinParams = null
    seen.clear()
    chatBucket = new TokenBucket(5, 1)
  }

  function endSession(reason: string) {
    teardown()
    set({ status: 'ended', endedReason: reason, peers: {}, mic: 'off', muted: true, world: null })
  }

  function applyBlocks(mgr: NetworkManager) {
    for (const id of blockedIds) mgr.setBlocked(id, true)
    world?.setBlockedIds(blockedIds)
  }

  function startNetwork(ack: JoinAck) {
    manager?.close()
    const map = loadWorldMap(ack.room.map)
    const relay =
      ack.iceTransportPolicy === 'relay' || (hideIpChoice && ack.relayAvailable) ? 'relay' : 'all'

    const mgr = new NetworkManager({
      selfId: ack.self.id,
      socket: socket!,
      iceServers: ack.iceServers,
      iceTransportPolicy: relay,
      chatMax,
      // In a world, voice only flows to people who can hear us; the world switches it on per person.
      audioDefault: !map,
      handlers: {
        onPeerState: (id, link) => updatePeer(id, { link }),
        onPeerStream: (id, stream) => {
          updatePeer(id, { stream })
          world?.onPeerStream(id, stream)
        },
        onPeerMessage: (from, msg) => handlePeerMessage(from, msg),
        onPeerAbuse: (id) => {
          const name = get().peers[id]?.name ?? 'Someone'
          blockPeer(id)
          toast.warning(`${name} was sending far too much data, so they were blocked for you.`, {
            duration: 8000,
          })
        },
      },
    })
    manager = mgr
    mgr.setLocalAudioTrack(localTrack)
    mgr.setPresence({ muted: get().muted })

    const peers: Record<string, PeerView> = {}
    for (const p of ack.peers) peers[p.id] = { ...p, link: 'connecting', muted: true, stream: null }
    // Rooms with a map get a world. A re-join after a connection drop keeps the same
    // session so you reappear where you were standing.
    if (map) {
      world ??= new WorldSession({ map, selfId: ack.self.id })
      world.attach(
        (msg) => void mgr.sendPosition(msg),
        (id, on) => mgr.setPeerAudio(id, on),
      )
    }
    applyBlocks(mgr)
    set({
      status: 'joined',
      room: ack.room,
      selfId: ack.self.id,
      peers,
      world,
      blocked: blockedRecord(),
      relayOnly: relay === 'relay',
    })

    // We are the newcomer: we dial everyone already inside.
    for (const p of ack.peers) mgr.connect(p.id, true)
  }

  /**
   * The signaling socket came back and the server kept our seat: same tab, same peers.
   * Nothing was torn down while it was away, so voice never cut out. Only reconcile what
   * changed in the meantime (people who joined or left while we couldn't hear about it).
   */
  function resumeNetwork(ack: JoinAck) {
    const mgr = manager
    if (!mgr) return startNetwork(ack)
    const present = new Set(ack.peers.map((p) => p.id))
    const before = get().peers
    for (const id of Object.keys(before)) {
      if (!present.has(id)) world?.onPeerLeft(id)
    }
    const peers: Record<string, PeerView> = {}
    for (const p of ack.peers) {
      peers[p.id] = before[p.id] ?? { ...p, link: 'connecting', muted: true, stream: null }
    }
    set({ status: 'joined', room: ack.room, peers })
    mgr.reconcile([...present])
  }

  function handlePeerMessage(from: string, msg: P2PMessage) {
    if (msg.type === 'presence') return updatePeer(from, { muted: msg.muted })
    if (msg.type === 'pos') return world?.onRemotePosition(from, msg)

    // A peer chooses its own message id: never let it show the same one twice.
    const key = `${from}:${msg.id}`
    if (seen.has(key)) return
    seen.add(key)
    if (seen.size > MAX_SEEN_IDS) seen.delete(seen.values().next().value!)

    const peer = get().peers[from]
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: key,
          fromId: from,
          fromName: peer?.name ?? 'Unknown',
          text: msg.text,
          // ordered by when it reached us, not by a clock the sender controls
          ts: Date.now(),
          self: false,
        },
      ].slice(-MAX_MESSAGES),
    }))
  }

  function blockPeer(id: string) {
    blockedIds.add(id)
    saveBlocked(blockedIds)
    manager?.setBlocked(id, true)
    world?.setBlockedIds(blockedIds)
    set({ blocked: blockedRecord() })
  }

  function attachSocketListeners(s: Socket) {
    s.on('peer:joined', (peer: PeerInfo) => {
      if (get().status !== 'joined') return
      addPeer(peer)
      manager?.connect(peer.id, false) // they will dial us
    })

    s.on('peer:left', ({ userId }: { userId: string }) => {
      manager?.disconnect(userId)
      world?.onPeerLeft(userId)
      removePeer(userId)
    })

    s.on('room:replaced', () => {
      endSession('You joined this room from another tab, so this session was closed.')
    })

    s.on('room:kicked', () => {
      endSession('The host removed you from this room.')
    })

    s.on('disconnect', (reason: string) => {
      if (reason === 'io client disconnect') return
      // Only the signaling connection dropped. The peer-to-peer links do not depend on it, so
      // they stay up: voice and chat keep working while socket.io reconnects and we re-join.
      // The server holds our seat for a short grace period.
      if (get().status === 'joined') set({ status: 'reconnecting' })
    })

    s.on('connect', async () => {
      if (get().status !== 'reconnecting' || !joinParams) return
      const gen = generation
      const ack = await emitJoin(s, joinParams)
      if (gen !== generation) return
      if (!ack.ok) return endSession(`Couldn't rejoin the room: ${ack.message}`)
      if (ack.resumed) resumeNetwork(ack)
      else startNetwork(ack) // the seat had expired: this is a fresh join, peers will dial us anew
    })
  }

  return {
    ...initial,
    blocked: blockedRecord(),

    join: async (roomId, { joinCode, withMic, hideIp }) => {
      if (get().status !== 'idle') {
        return { ok: false, code: 'BUSY', message: 'You are already in a room.' }
      }
      const gen = ++generation
      set({ ...initial, blocked: blockedRecord(), status: 'joining' })
      hideIpChoice = Boolean(hideIp)
      const fail = (f: JoinFailure): JoinFailure => {
        if (gen === generation) {
          teardown()
          set({ ...initial, blocked: blockedRecord() })
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
      set({ ...initial, blocked: blockedRecord() })
    },

    sendChat: (text) => {
      const trimmed = text.trim()
      const { selfId, status } = get()
      // Chat travels peer-to-peer, so it keeps working while only the signaling connection is down.
      const live = status === 'joined' || status === 'reconnecting'
      if (!trimmed || trimmed.length > chatMax || !live || !selfId) return 'invalid'
      if (!chatBucket.take()) return 'slow-down'

      const msg = { type: 'chat' as const, id: newId(), text: trimmed, ts: Date.now() }
      manager?.broadcast(msg)
      set((s) => ({
        messages: [
          ...s.messages,
          { id: msg.id, fromId: selfId, fromName: 'You', text: trimmed, ts: msg.ts, self: true },
        ].slice(-MAX_MESSAGES),
      }))
      return 'sent'
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

    blockPeer,

    unblockPeer: (id) => {
      blockedIds.delete(id)
      saveBlocked(blockedIds)
      manager?.setBlocked(id, false)
      world?.setBlockedIds(blockedIds)
      set({ blocked: blockedRecord() })
    },

    kickPeer: (id) =>
      new Promise((resolve) => {
        const s = socket
        if (!s?.connected) return resolve({ ok: false, message: 'Not connected to the server.' })
        s.timeout(5000).emit(
          'room:kick',
          { userId: id },
          (err: Error | null, res?: { ok: boolean; message?: string }) =>
            resolve(err || !res ? { ok: false, message: 'The server did not respond.' } : res),
        )
      }),

    reportPeer: async (id, reason, details) => {
      const { room, messages } = get()
      if (!room) return { ok: false, message: 'You are not in a room.' }
      // The server never sees chat. The most recent thing this person said is sent along as
      // context: it is the reporter's claim, which moderators treat as such.
      const last = [...messages].reverse().find((m) => m.fromId === id)
      try {
        await reportsApi.create({
          reportedId: id,
          roomId: room.id,
          reason,
          details: details?.trim() || undefined,
          messageExcerpt: last?.text.slice(0, 500),
        })
        return { ok: true }
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Could not send the report.' }
      }
    },
  }
})
