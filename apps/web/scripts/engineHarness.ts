/**
 * Runs the REAL WorldEngine without a browser, for tests and screenshots: a napi canvas stands in for the <canvas>,
 * a few `window` bits are stubbed, and time is advanced by hand with step(). Not a test file (no `.test.ts`).
 */
import { createCanvas } from '@napi-rs/canvas'
import fs from 'node:fs'
import { buildWorldMap, parseMapFile } from '../src/world/format/mapFile.ts'
import { WorldEngine } from '../src/world/WorldEngine.ts'
import { WorldSession } from '../src/world/WorldSession.ts'
import { TILE, type Character, type Seat, type WorldMap } from '../src/world/types.ts'

;(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = function (w: number, h: number) {
  return createCanvas(w, h)
}
const g = globalThis as unknown as { window?: unknown; performance: Performance }
g.window ??= { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 }

export function loadMap(key: string): WorldMap {
  const raw = JSON.parse(fs.readFileSync(new URL(`../src/world/maps/data/${key}.map.json`, import.meta.url), 'utf8'))
  const { map, issues } = parseMapFile(raw)
  if (!map) throw new Error(JSON.stringify(issues))
  return buildWorldMap(map)
}

interface Internals {
  update(dt: number): void
  render(t: number): void
  resize(): void
  keys: Set<string>
  path: unknown[]
  player: Character
  remote: Map<string, Character>
  prompt: { prompt: { kind: string; label: string; seat: Seat }; rect: { x: number; y: number; w: number; h: number } | null } | null
  walkToTile(col: number, row: number): void
  pressPrompt(x: number, y: number): boolean
  view: { x: number; y: number }
  zoom: number
  cssW: number
  cssH: number
}

export function makeEngine(map: WorldMap, at: { col: number; row: number }, size = { w: 800, h: 560 }) {
  const canvas = createCanvas(size.w, size.h) as unknown as HTMLCanvasElement & { style: Record<string, string> }
  canvas.style = {}
  ;(canvas as unknown as { getBoundingClientRect: () => unknown }).getBoundingClientRect = () => ({ left: 0, top: 0, width: size.w, height: size.h })
  const session = new WorldSession({ map, selfId: 'me' })
  session.local.x = at.col + 0.5
  session.local.y = at.row + 0.5
  const engine = new WorldEngine({ canvas, session, selfId: 'me', getSelf: () => ({ name: 'Me', muted: false }), getPeers: () => ({}) })
  const e = engine as unknown as Internals
  e.resize()
  let now = 1000
  const api = {
    engine,
    session,
    e,
    canvas: canvas as unknown as ReturnType<typeof createCanvas>,
    /** advance the simulation (each step is one 60 fps frame) */
    step(frames = 1) {
      for (let i = 0; i < frames; i++) {
        now += 1000 / 60
        e.update(1 / 60)
        if (i % 6 === 5) {
          e.render(now) // keeps the frame clock moving, like the real loop
          ;(session as unknown as { tick(): void }).tick() // and the session's 10 Hz broadcast
        }
      }
    },
    draw() {
      e.render(now)
    },
    hold(key: string, frames: number) {
      e.keys.add(key)
      api.step(frames)
      e.keys.delete(key)
    },
    tile: () => ({ col: Math.floor(e.player.x / TILE), row: Math.floor(e.player.y / TILE) }),
    /** put another person at a tile centre, standing still */
    placeRemote(id: string, col: number, row: number, dir: 'up' | 'down' | 'left' | 'right' = 'down') {
      session.remotes.set(id, { x: col + 0.5, y: row + 0.5, dir, moving: false })
    },
    close() {
      session.close()
    },
  }
  return api
}
