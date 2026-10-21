import type { WorldMap } from '../types'
import { buildBeachMap } from './beach'
import { buildCommonsMap } from './commons'
import { buildMarketMap } from './market'

/** Must match MAPS in apps/api/src/config/rooms.config.ts. */
export type WorldMapKey = 'commons' | 'beach' | 'market'
export type RoomMapKey = WorldMapKey

const builders: Record<WorldMapKey, () => WorldMap> = {
  commons: buildCommonsMap,
  beach: buildBeachMap,
  market: buildMarketMap,
}

/** Built lazily and cached: each room only ever needs its own map. */
const cache = new Map<WorldMapKey, WorldMap>()

export function loadWorldMap(key: RoomMapKey | undefined): WorldMap | null {
  // Defensive only: a server newer than this client may send a map key we don't know yet.
  // Creation always requires a map, so this fallback (a plain voice/chat room) is not a feature.
  if (!key || !(key in builders)) return null
  let map = cache.get(key)
  if (!map) {
    map = builders[key]()
    cache.set(key, map)
  }
  return map
}
