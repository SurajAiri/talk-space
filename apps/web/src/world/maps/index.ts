/**
 * THE MAP REGISTRY. Every `data/<key>.map.json` is discovered automatically (Vite glob),
 * validated, and registered under its `key`. To add a map: drop a file in `data/`
 * (the editor's Save button does exactly that). There is no list to edit.
 *
 * The server never sees map contents; it only stores the key chosen at room creation.
 */
import { buildWorldMap, parseMapFile, type MapFile } from '../format/mapFile.ts'
import type { WorldMap } from '../types.ts'

/** A map key as stored on a room (see MAP_KEY_REGEX). */
export type RoomMapKey = string

const modules = import.meta.glob('./data/*.map.json', { eager: true, import: 'default' }) as Record<string, unknown>

const files = new Map<string, MapFile>()
const worlds = new Map<string, WorldMap>()

for (const [path, raw] of Object.entries(modules)) {
  const { map, issues } = parseMapFile(raw)
  const fileKey = /([^/]+)\.map\.json$/.exec(path)?.[1]
  if (!map) {
    console.error(`[maps] ${path} is invalid and was skipped:`, issues.filter((i) => i.level === 'error'))
    continue
  }
  if (map.key !== fileKey) {
    console.error(`[maps] ${path}: "key" is "${map.key}" but the file name says "${fileKey}". Skipped.`)
    continue
  }
  files.set(map.key, map)
  worlds.set(map.key, buildWorldMap(map))
}

/** The runnable map for a key, or null if unknown (callers fall back to a plain voice room). */
export function loadWorldMap(key: RoomMapKey | undefined): WorldMap | null {
  return (key && worlds.get(key)) || null
}

/** For pickers: every registered map, sorted by title. */
export function listWorldMaps(): { key: string; title: string; description?: string }[] {
  return [...files.values()]
    .map((f) => ({ key: f.key, title: f.title, ...(f.description ? { description: f.description } : {}) }))
    .sort((a, b) => a.title.localeCompare(b.title))
}

/** Raw files (editor only). */
export function listMapFiles(): MapFile[] {
  return [...files.values()]
}
