# Maps

A map is **one JSON file** in `data/`. That is the whole registry: drop a file in, it appears in
the "Create room" picker. The API never sees map contents (it only stores the key), so adding a
map touches nothing outside this folder.

```
src/world/
  assets/        the "asset packs" (copy-pasteable, no app imports)
    tiles.ts       TILESET: every ground tile (char, name, solid, draw fn)
    props.ts       PROP_CATALOG: every placeable object (size, solid, resize rules, draw fn), SEAT_STYLES
  format/        the map file format (pure TS, also runs in Node)
    mapFile.ts     types, parseMapFile (reports ALL errors with paths), buildWorldMap, serializeMapFile
    ops.ts         pure edit operations + the JSON "ops script" interpreter (shared by GUI, CLI, AI)
    validate.ts    semantic checks: spawn, unreachable zones, overlaps, cut-off areas
  maps/
    data/*.map.json   <- the maps
    index.ts          auto-discovers data/*.map.json (Vite glob)
  editor/        dev-only GUI editor (EditorModel, ToolController are DOM-free and unit-testable)
  render/, WorldEngine.ts, WorldSession.ts, hearing.ts, navigation.ts   runtime (unchanged by maps)
tools/           maps.ts (CLI), mapStore.ts (disk I/O), vite-plugin-map-editor.ts (dev save endpoint)
```

## Make a map

**GUI** (dev server only): `pnpm dev`, open `/dev/maps`. Tools: paint, rectangle, outline (walls),
bucket, eyedropper, props (drag to resize those that allow it), seats, audio zones (drag; corner
handles resize), spawn, erase; undo/redo (Ctrl+Z / Ctrl+Y), Ctrl+S saves. The *Problems* panel is the
same validator the CLI uses. *Play test* walks your unsaved map with the real engine.
Save writes `data/<key>.map.json`; reload the app tab to see it in the room picker.

**CLI** (plain Node >= 22.18, no build): run `pnpm maps spec` first; it prints the complete format
spec, tile legend and prop catalog generated from the code, so it can never be out of date.

```
pnpm maps new my-map --title "My Map" --cols 44 --rows 32 --fill grass
pnpm maps apply my-map ops.json --dry-run     # JSON op list: fillRect, strokeRect, addProp, addZone, ...
pnpm maps show my-map --zones                 # ASCII picture with coordinates + zone overlay
pnpm maps check                               # all maps; exit 1 on errors (use in CI); --strict fails on warnings
```
`apply` refuses to write anything unless the result has zero errors.

**By hand / AI**: edit `data/<key>.map.json` directly (tiles are rows of characters), then
`pnpm maps check` and `pnpm maps fmt`. In the GUI, *Import JSON* validates pasted text before loading it.

## Zones are the point
Everyone inside the same zone hears each other at any distance; everything outside a zone is open
area (volume fades with distance). A zone only changes audio: draw its walls and floor with tiles.

## Add a tile or prop
One entry in `assets/tiles.ts` (`TILESET`) or `assets/props.ts` (`PROP_CATALOG`) plus its draw
function. The editor palette, validator, CLI and file format pick it up automatically. Never reuse or
renumber an existing tile `char`; old map files depend on it.

## Notes
- Map `key` = file name = what a room stores; keep `^[a-z0-9][a-z0-9_-]{0,31}$`. A room whose key
  has no matching file falls back to a plain voice/chat room.
- All maps are bundled into the web app (small JSON). If you reach dozens of large maps, switch the
  glob in `index.ts` to lazy loading.
