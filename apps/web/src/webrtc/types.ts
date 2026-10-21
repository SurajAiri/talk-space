export interface PeerInfo {
  id: string
  name: string
  username: string
}

/** Relayed (never inspected) by the signaling server. */
export interface SignalData {
  description?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
}

/** Everything that travels peer-to-peer over the data channel. */
export type P2PMessage =
  | { type: 'chat'; id: string; text: string; ts: number }
  | { type: 'presence'; muted: boolean }
  | PosMessage

/**
 * Where a person stands in the room's 2D world, in TILE units (not pixels), so the
 * protocol never depends on rendering. Travels on the unreliable channel: a lost
 * update is superseded by the next one, and a late one is worse than none.
 */
export interface PosMessage {
  type: 'pos'
  x: number
  y: number
  dir: 'up' | 'down' | 'left' | 'right'
  moving: boolean
}

const DIRS = ['up', 'down', 'left', 'right']
/** Generous upper bound; the world clamps to its real map size. Rejects NaN/Infinity/garbage. */
const isCoord = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 500

export type LinkState = 'connecting' | 'connected' | 'unstable' | 'failed' | 'closed'

const MAX_RAW_MESSAGE = 16_000

/** Parses + validates untrusted data from a peer. Returns null for anything unexpected. */
export function parseP2PMessage(raw: unknown, chatMax: number): P2PMessage | null {
  if (typeof raw !== 'string' || raw.length > MAX_RAW_MESSAGE) return null
  let msg: unknown
  try {
    msg = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof msg !== 'object' || msg === null) return null
  const m = msg as Record<string, unknown>

  if (m.type === 'presence' && typeof m.muted === 'boolean') {
    return { type: 'presence', muted: m.muted }
  }
  if (
    m.type === 'pos' &&
    isCoord(m.x) &&
    isCoord(m.y) &&
    typeof m.dir === 'string' &&
    DIRS.includes(m.dir) &&
    typeof m.moving === 'boolean'
  ) {
    return { type: 'pos', x: m.x, y: m.y, dir: m.dir as PosMessage['dir'], moving: m.moving }
  }
  if (
    m.type === 'chat' &&
    typeof m.id === 'string' &&
    m.id.length <= 64 &&
    typeof m.text === 'string' &&
    m.text.trim().length > 0 &&
    m.text.length <= chatMax &&
    typeof m.ts === 'number'
  ) {
    return { type: 'chat', id: m.id, text: m.text, ts: m.ts }
  }
  return null
}
