/**
 * Reading and writing map files on disk. Node-only. Shared by the CLI (tools/maps.ts)
 * and the dev-server save endpoint (tools/vite-plugin-map-editor.ts), so both apply the
 * same validation and write the same canonical text.
 */
import fs from 'node:fs'
import path from 'node:path'
import { MAP_KEY_REGEX, parseMapFile, serializeMapFile, type Issue, type MapFile } from '../src/world/format/mapFile.ts'
import { validateMap } from '../src/world/format/validate.ts'

const SUFFIX = '.map.json'

export const fileFor = (dir: string, key: string) => {
  if (!MAP_KEY_REGEX.test(key)) throw new Error(`invalid map key ${JSON.stringify(key)}`)
  return path.join(dir, key + SUFFIX)
}

export function listKeys(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith(SUFFIX)).map((f) => f.slice(0, -SUFFIX.length)).sort()
}

/** Parse + structural validation of a file on disk (semantic checks: see `check`). */
export function readMap(dir: string, key: string): { map: MapFile | null; issues: Issue[] } {
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(fileFor(dir, key), 'utf8'))
  } catch (e) {
    return { map: null, issues: [{ level: 'error', path: key, message: `cannot read/parse: ${(e as Error).message}` }] }
  }
  const r = parseMapFile(raw)
  if (r.map && r.map.key !== key) r.issues.push({ level: 'error', path: 'key', message: `is "${r.map.key}" but the file is named ${key}${SUFFIX}` })
  return r
}

/** Everything wrong with a map: structural errors, then semantic errors/warnings. */
export function checkMap(input: unknown): { map: MapFile | null; issues: Issue[] } {
  const { map, issues } = parseMapFile(input)
  return { map, issues: map ? [...issues, ...validateMap(map)] : issues }
}

export interface SaveResult {
  ok: boolean
  issues: Issue[]
  file?: string
}

/**
 * Validate, canonicalise and write. Refuses (writes nothing) if there is any ERROR.
 * Warnings never block a save: a half-built map must be saveable.
 */
export function saveMap(dir: string, input: unknown, opts: { allowCreate?: boolean } = {}): SaveResult {
  const { map, issues } = checkMap(input)
  if (!map || issues.some((i) => i.level === 'error')) return { ok: false, issues }
  const file = fileFor(dir, map.key)
  if (!opts.allowCreate && !fs.existsSync(file)) return { ok: false, issues: [...issues, { level: 'error', path: 'key', message: `no map "${map.key}" exists` }] }
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, serializeMapFile(map)) // write-then-rename: a crash never leaves a half-written map
  fs.renameSync(tmp, file)
  return { ok: true, issues, file }
}
