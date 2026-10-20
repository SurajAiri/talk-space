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
