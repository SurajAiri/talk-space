/**
 * Map CLI. Runs on plain Node (>= 22.18, type stripping), no build step:
 *
 *   pnpm maps spec                      everything an AI/person needs to know to author a map
 *   pnpm maps list
 *   pnpm maps check [key...] [--strict] validate (all maps if none given); exit 1 on errors
 *   pnpm maps show <key> [--zones]      ASCII picture with coordinates
 *   pnpm maps new <key> --title "T" [--cols 44 --rows 32 --fill grass]
 *   pnpm maps apply <key> <ops.json|-> [--dry-run]   scripted edit (see `spec` for the ops)
 *   pnpm maps fmt [key...]              rewrite files in canonical formatting
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROP_CATALOG, SEAT_STYLES } from '../src/world/assets/props.ts'
import { DEFAULT_TILE, TILESET, tileById } from '../src/world/assets/tiles.ts'
import { applyOps, resolveTile } from '../src/world/format/ops.ts'
import { buildWorldMap, emptyMapFile, MAP_FORMAT_VERSION, MAP_KEY_REGEX, MAP_LIMITS, serializeMapFile, type Issue, type MapFile } from '../src/world/format/mapFile.ts'
import { isTileBlocked } from '../src/world/navigation.ts'
import { DIRS } from '../src/world/types.ts'
import { checkMap, fileFor, listKeys, readMap, saveMap } from './mapStore.ts'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/world/maps/data')

function fail(msg: string): never {
  console.error(`error: ${msg}`)
  process.exit(1)
}

function printIssues(issues: Issue[]) {
  for (const i of issues) console.log(`  ${i.level === 'error' ? 'ERROR  ' : 'warning'} ${i.path ? i.path + ': ' : ''}${i.message}`)
}

/** ASCII picture: tile characters, `O` solid prop, `o` walk-through prop, `S` seat, `@` spawn. */
function ascii(file: MapFile, withZones: boolean): string {
  const map = buildWorldMap(file)
  const { cols, rows } = file.size
  const cells = file.tiles.map((r) => Array.from(r))
  for (const p of map.props) {
    if (p.type === 'seat') continue
    for (let r = p.row; r < p.row + p.h; r++) for (let c = p.col; c < p.col + p.w; c++) if (cells[r]?.[c] !== undefined) cells[r]![c] = p.solid ? 'O' : 'o'
  }
  for (const s of file.seats) if (cells[s.row]?.[s.col] !== undefined) cells[s.row]![s.col] = 'S'
  const [sc, sr] = file.spawn
  if (cells[sr]?.[sc] !== undefined) cells[sr]![sc] = '@'

  const pad = String(rows - 1).length
  const ruler1 = ' '.repeat(pad + 1) + Array.from({ length: cols }, (_, c) => (c % 10 === 0 ? String(Math.floor(c / 10) % 10) : ' ')).join('')
  const ruler2 = ' '.repeat(pad + 1) + Array.from({ length: cols }, (_, c) => c % 10).join('')
  const body = cells.map((r, i) => `${String(i).padStart(pad)} ${r.join('')}`)
  let out = [ruler1, ruler2, ...body].join('\n')

  if (withZones && file.zones.length) {
    const zoneRows = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => {
        const z = file.zones.findIndex((zz) => c >= zz.rect[0] && c <= zz.rect[2] && r >= zz.rect[1] && r <= zz.rect[3])
        return z < 0 ? '.' : isTileBlocked(map, c, r) ? '#' : String((z + 1) % 10)
      }).join(''),
    )
    out += '\n\nzones (digit = zone number, # = blocked inside a zone, . = open area):\n' + [ruler1, ruler2, ...zoneRows.map((r, i) => `${String(i).padStart(pad)} ${r}`)].join('\n')
    out += '\n' + file.zones.map((z, i) => `  ${(i + 1) % 10} = ${z.id} "${z.name}" rect [${z.rect.join(', ')}]`).join('\n')
  }
  return out
}

function spec(): string {
  const tile = TILESET.map((t) => `  ${JSON.stringify(t.char).padEnd(5)} ${t.name.padEnd(16)} ${t.category.padEnd(7)} ${t.solid ? 'SOLID (blocks walking)' : 'walkable'}`).join('\n')
  const props = PROP_CATALOG.filter((p) => !p.hidden)
    .map((p) => `  ${p.type.padEnd(13)} ${`${p.w}x${p.h}`.padEnd(4)} ${p.solid ? 'solid    ' : 'walkable '} resize=${p.resize}${p.minW ? ` minW=${p.minW}` : ''}${p.variants ? ` variants=${p.variants.join('|')}` : ''}${p.color ? ' tintable(color)' : ''}  // ${p.label}`)
    .join('\n')
  return `MAP AUTHORING SPEC (format ${MAP_FORMAT_VERSION})

A map is one JSON file: apps/web/src/world/maps/data/<key>.map.json. It is picked up
automatically (no registry to edit) and appears in the "Create room" map picker.

COORDINATES  (col, row) = (x, y), origin top-left, 0-based. One tile = one cell of "tiles".
RECTS        [col1, row1, col2, row2], INCLUSIVE on both ends.

FILE SHAPE
  {
    "format": ${MAP_FORMAT_VERSION},
    "key": "my-map",                 // = file name; ^[a-z0-9][a-z0-9_-]{0,31}$
    "title": "My Map",               // 1-60 chars, shown in the picker
    "description": "optional",       // <= 200 chars
    "size": { "cols": 44, "rows": 32 },       // ${MAP_LIMITS.minSize}-${MAP_LIMITS.maxSize} each
    "spawn": [22, 16],               // where people appear: a free tile in the OPEN area
    "tiles": [ "....", "...." ],     // exactly size.rows strings of exactly size.cols chars
    "props":  [ {"type":"tree","col":4,"row":5,"variant":"oak"} ],
    "seats":  [ {"col":3,"row":4,"dir":"down","style":"stool","color":"#6366f1"} ],
    "zones":  [ {"id":"cafe","name":"Café","rect":[2,2,16,13]} ]
  }

TILES (characters used in "tiles"; default fill is ${JSON.stringify(DEFAULT_TILE.char)})
${tile}

PROPS (placed on top of tiles; col,row = top-left; w,h omitted = default size)
${props}
  Optional per prop: "solid" (override), "variant", "color" (#rrggbb, tintable props only).
  Overlapping SOLID props are a warning. Non-solid props can be walked through.

SEATS  A person who stops on a seat tile sits and faces "dir" (${DIRS.join('|')}).
  styles: ${SEAT_STYLES.join(', ')}. "sofa_cushion" draws nothing: put it on top of a sofa_horiz.

ZONES  (this is the audio model: the reason maps exist)
  Everyone standing inside the SAME zone hears each other at full volume, at any distance.
  Anyone outside it (open area or another zone) hears nothing from it, and vice versa.
  Everything NOT in a zone is the "open area": there, volume fades with distance (full
  within 2 tiles, silent beyond 7). So: make a zone for each room/hall/camp that should be a
  private conversation; leave plazas and paths as open area so people can mingle.
  Zone rects must not overlap, must contain >= 6 walkable tiles and be enterable from spawn.
  A zone only changes audio; draw its walls/floor yourself with tiles.

RULES OF THUMB
  - Walls (#) and water (~) block. Leave a 2-tile door gap in a wall so a room can be entered.
  - Keep spawn in the open area with >= 12 free tiles around it, away from zones.
  - Every area you want people to reach must be connected to spawn (run \`check\`).

SCRIPTED EDITS: \`pnpm maps apply <key> ops.json\`; ops.json is an array, applied in order.
  Tiles may be given as a character or a name ("wall", "water", "cafe floor").
  {"op":"fillRect","tile":"cobblestone","rect":[0,10,43,12]}
  {"op":"strokeRect","tile":"wall","rect":[2,2,16,13]}          // outline only
  {"op":"fillRect","tile":"cafe floor","rect":[3,3,15,12]}
  {"op":"fillRect","tile":"cobblestone","rect":[8,13,9,13]}      // carve a door
  {"op":"setTiles","tile":"sand","cells":[[1,1],[2,1]]}
  {"op":"floodFill","tile":"sand","at":[5,5]}                    // replace the connected region
  {"op":"addProp","type":"tree","col":4,"row":5,"variant":"oak"}
  {"op":"removeProps","rect":[0,0,10,10]}                        // by top-left corner
  {"op":"addSeat","col":3,"row":4,"dir":"down","style":"stool"}
  {"op":"removeSeats","rect":[0,0,10,10]}
  {"op":"addZone","id":"cafe","name":"Café","rect":[2,2,16,13]}
  {"op":"removeZone","id":"cafe"}
  {"op":"setSpawn","at":[22,16]}
  {"op":"setMeta","title":"New title","description":"..."}
  {"op":"resize","cols":60,"rows":40,"fill":"grass"}            // anchored top-left
  Nothing is written unless the result has zero errors. Use --dry-run to preview.

WORKFLOW FOR AN AI: pnpm maps spec -> pnpm maps new ... -> write ops.json -> pnpm maps apply
  -> pnpm maps show <key> --zones (look at it!) -> fix every warning/error -> pnpm maps check.
`
}

const [cmd, ...rest] = process.argv.slice(2)
const VALUE_FLAGS = new Set(['--title', '--cols', '--rows', '--fill'])
const flags = new Set<string>()
const flagValues = new Map<string, string>()
const positional: string[] = []
for (let i = 0; i < rest.length; i++) {
  const a = rest[i]!
  if (VALUE_FLAGS.has(a)) flagValues.set(a, rest[++i] ?? fail(`${a} needs a value`))
  else if (a.startsWith('--')) flags.add(a)
  else positional.push(a)
}
const flagVal = (name: string) => flagValues.get(name)

switch (cmd) {
  case 'spec':
    console.log(spec())
    break

  case 'list': {
    for (const key of listKeys(DIR)) {
      const { map, issues } = readMap(DIR, key)
      console.log(map ? `${key.padEnd(14)} ${map.size.cols}x${map.size.rows}  props=${map.props.length} seats=${map.seats.length} zones=${map.zones.length}  "${map.title}"` : `${key.padEnd(14)} INVALID (${issues.filter((i) => i.level === 'error').length} errors)`)
    }
    break
  }

  case 'check': {
    const keys = positional.length ? positional : listKeys(DIR)
    let errors = 0
    let warnings = 0
    for (const key of keys) {
      let raw: unknown
      try {
        raw = JSON.parse(fs.readFileSync(fileFor(DIR, key), 'utf8'))
      } catch (e) {
        console.log(`${key}: cannot read: ${(e as Error).message}`)
        errors++
        continue
      }
      const { map, issues } = checkMap(raw)
      if (map && map.key !== key) issues.push({ level: 'error', path: 'key', message: `is "${map.key}" but the file is named ${key}.map.json` })
      const e = issues.filter((i) => i.level === 'error').length
      const w = issues.length - e
      errors += e
      warnings += w
      console.log(`${key}: ${e ? 'FAIL' : 'ok'}  (${e} errors, ${w} warnings)`)
      printIssues(issues)
    }
    if (errors || (flags.has('--strict') && warnings)) process.exit(1)
    break
  }

  case 'show': {
    const key = positional[0] ?? fail('usage: maps show <key> [--zones]')
    const { map, issues } = readMap(DIR, key)
    if (!map) {
      printIssues(issues)
      process.exit(1)
    }
    console.log(`${map.title} (${key}) ${map.size.cols}x${map.size.rows}   legend: O solid prop, o walk-through prop, S seat, @ spawn`)
    console.log(ascii(map, flags.has('--zones')))
    console.log('\ntiles: ' + TILESET.map((t) => `${t.char}=${t.name}`).join('  '))
    break
  }

  case 'new': {
    const key = positional[0] ?? fail('usage: maps new <key> --title "Title" [--cols 44 --rows 32 --fill grass]')
    if (!MAP_KEY_REGEX.test(key)) fail('key must match ^[a-z0-9][a-z0-9_-]{0,31}$')
    if (fs.existsSync(fileFor(DIR, key))) fail(`${key} already exists`)
    const fill = flagVal('--fill') ? (resolveTile(flagVal('--fill')) ?? fail(`unknown fill tile ${flagVal('--fill')}`)) : DEFAULT_TILE.char
    const file = emptyMapFile(key, flagVal('--title') ?? key, Number(flagVal('--cols') ?? 44), Number(flagVal('--rows') ?? 32), fill)
    const res = saveMap(DIR, file, { allowCreate: true })
    printIssues(res.issues)
    if (!res.ok) process.exit(1)
    console.log(`created ${path.relative(process.cwd(), res.file!)} (fill ${JSON.stringify(fill)} = ${tileById(TILESET.find((t) => t.char === fill)!.id)?.name})`)
    break
  }

  case 'apply': {
    const key = positional[0] ?? fail('usage: maps apply <key> <ops.json|-> [--dry-run]')
    const src = positional[1] ?? fail('missing ops file (use - for stdin)')
    const { map, issues: readIssues } = readMap(DIR, key)
    if (!map) {
      printIssues(readIssues)
      process.exit(1)
    }
    let ops: unknown
    try {
      ops = JSON.parse(fs.readFileSync(src === '-' ? 0 : src, 'utf8'))
    } catch (e) {
      fail(`cannot read ops: ${(e as Error).message}`)
    }
    const applied = applyOps(map, ops)
    const checked = checkMap(applied.map)
    const issues = [...applied.issues, ...checked.issues]
    printIssues(issues)
    const errors = issues.filter((i) => i.level === 'error').length
    if (errors) {
      console.log(`\nnot written: ${errors} error(s)`)
      process.exit(1)
    }
    if (flags.has('--dry-run')) {
      console.log('\n--dry-run: nothing written. Preview:\n' + ascii(checked.map!, true))
      break
    }
    saveMap(DIR, applied.map)
    console.log(`\nwritten ${key}.map.json (${issues.length} warning(s)). Run: pnpm maps show ${key} --zones`)
    break
  }

  case 'fmt': {
    for (const key of positional.length ? positional : listKeys(DIR)) {
      const { map, issues } = readMap(DIR, key)
      if (!map) {
        console.log(`${key}: skipped (invalid)`)
        printIssues(issues)
        continue
      }
      const text = serializeMapFile(map)
      const same = fs.readFileSync(fileFor(DIR, key), 'utf8') === text
      if (!same) fs.writeFileSync(fileFor(DIR, key), text)
      console.log(`${key}: ${same ? 'already canonical' : 'reformatted'}`)
    }
    break
  }

  default:
    console.log(`usage: pnpm maps <spec|list|check|show|new|apply|fmt> ...   (pnpm maps spec for the full authoring guide)`)
    process.exit(cmd ? 1 : 0)
}
