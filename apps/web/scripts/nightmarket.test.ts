import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import { buildWorldMap, parseMapFile } from '../src/world/format/mapFile.ts'
import { validateMap } from '../src/world/format/validate.ts'
import { PROP_CATALOG, propDef, type Light } from '../src/world/assets/props.ts'
import { TILESET, tileByChar } from '../src/world/assets/tiles.ts'
import { nightPropsOf } from '../src/world/render/scene.ts'

const market = JSON.parse(fs.readFileSync(new URL('../src/world/maps/data/market.map.json', import.meta.url), 'utf8'))

test('asset packs: every tile id and character, and every prop type, is unique (old maps depend on them)', () => {
  assert.equal(new Set(TILESET.map((t) => t.id)).size, TILESET.length)
  assert.equal(new Set(TILESET.map((t) => t.char)).size, TILESET.length)
  assert.equal(new Set(PROP_CATALOG.map((p) => p.type)).size, PROP_CATALOG.length)
  assert.equal(tileByChar('.')?.id, 0, 'the original tiles did not move')
  assert.equal(tileByChar('Y')?.id, 44)
})

test('the Sky Night Market is a valid map with no warnings, and its tiles and props are the night-market ones', () => {
  const { map, issues } = parseMapFile(market)
  assert.ok(map, JSON.stringify(issues))
  assert.deepEqual(validateMap(map), [])
  const types = new Set(map.props.map((p) => p.type))
  for (const t of ['stall', 'string_lights', 'wishing_tree', 'floating_lantern', 'neon_sign', 'paper_lantern']) assert.ok(types.has(t), `no ${t}`)
  assert.ok(map.zones.length >= 3)
})

test('stalls come in eight kinds, each with its own look and its own light', () => {
  const def = propDef('stall')!
  assert.equal(def.variants?.length, 8)
  const lights: Light[] = []
  for (const variant of def.variants!) {
    const before = lights.length
    def.light!({ col: 4, row: 5, w: 3, h: 2, type: 'stall', solid: true, variant }, 0, (l) => lights.push(l))
    assert.ok(lights.length > before, `${variant} threw no light`)
  }
  assert.ok(lights.every((l) => l.r > 0 && l.a > 0 && l.a <= 1))
})

test('only props that glow or hang overhead go in the night layer, and daytime maps have none', () => {
  const world = buildWorldMap(parseMapFile(market).map!)
  const night = nightPropsOf(world.props)
  assert.ok(night.length > 20)
  assert.ok(night.every((p) => propDef(p.type)?.light || propDef(p.type)?.overhead))
  for (const key of ['beach', 'commons', 'lodge', 'zen', 'orbital']) {
    const raw = JSON.parse(fs.readFileSync(new URL(`../src/world/maps/data/${key}.map.json`, import.meta.url), 'utf8'))
    assert.equal(nightPropsOf(buildWorldMap(parseMapFile(raw).map!).props).length, 0, `${key} should be unaffected`)
  }
})

test('string lights hang over things: they draw nothing on the ground and light every span', () => {
  const def = propDef('string_lights')!
  assert.ok(def.overhead)
  const lights: Light[] = []
  def.light!({ col: 4, row: 8, w: 40, h: 1, type: 'string_lights', solid: false }, 0, (l) => lights.push(l))
  assert.equal(lights.length, Math.round((40 * 48) / 96))
})
