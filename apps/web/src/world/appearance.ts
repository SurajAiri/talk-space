/**
 * Avatars are derived from the user id, so every client draws every person the same
 * way with ZERO network traffic and nothing a peer could spoof. A customiser (which
 * would need a validated "avatar" P2P message) can replace this later.
 */
const SKIN = ['#ffdbb5', '#f5c293', '#e0a370', '#c68642', '#8d5524', '#5c3818']
const HAIR = ['#1e293b', '#451a03', '#92400e', '#eab308', '#dc2626', '#ec4899', '#06b6d4', '#e2e8f0']
const SHIRT = ['#10b981', '#6366f1', '#f43f5e', '#f59e0b', '#06b6d4', '#a855f7', '#ec4899', '#3b82f6']
const STYLES = ['spiky', 'bob', 'long', 'curly', 'bun']
const ACCESSORIES = ['none', 'none', 'none', 'glasses', 'headphones', 'sunhat', 'crown']

/** FNV-1a 32-bit. Not cryptographic; it only needs to spread ids evenly. */
export function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const pick = <T>(list: readonly T[], id: string, salt: string): T => list[hash32(`${salt}:${id}`) % list.length]!

export function appearanceFor(id: string) {
  return {
    skin: pick(SKIN, id, 'skin'),
    hairColor: pick(HAIR, id, 'hair'),
    hairStyle: pick(STYLES, id, 'style'),
    shirt: pick(SHIRT, id, 'shirt'),
    accessory: pick(ACCESSORIES, id, 'acc'),
    pants: '#1e293b',
  }
}
