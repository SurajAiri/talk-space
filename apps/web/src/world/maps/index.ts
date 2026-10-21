import type { WorldMap } from '../types'
import { buildBeachMap } from './beach'
import { buildCommonsMap } from './commons'
import { buildMarketMap } from './market'

/** Must match MAPS in apps/api/src/config/rooms.config.ts (minus "none"). */
export type WorldMapKey = 'commons' | 'beach' | 'market'
export type RoomMapKey = 'none' | WorldMapKey

const builders: Record<WorldMapKey, () => WorldMap> = {
  commons: buildCommonsMap,
  beach: buildBeachMap,
  market: buildMarketMap,
}

/** Built lazily and cached: each room only ever needs its own map. */
const cache = new Map<WorldMapKey, WorldMap>()

export function loadWorldMap(key: RoomMapKey | undefined): WorldMap | null {
  if (!key || key === 'none' || !(key in builders)) return null // unknown key => plain room
  let map = cache.get(key)
  if (!map) {
    map = builders[key]()
    cache.set(key, map)
  }
  return map
}
