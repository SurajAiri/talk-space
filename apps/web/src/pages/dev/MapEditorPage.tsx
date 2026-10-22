import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { PROP_CATALOG, propDef, SEAT_STYLES } from '../../world/assets/props.ts'
import { DEFAULT_TILE, TILESET } from '../../world/assets/tiles.ts'
import { EditorModel, type Selection, type ToolId } from '../../world/editor/EditorModel.ts'
import { EditorView, type Layers } from '../../world/editor/EditorView.ts'
import { catalogProp } from '../../world/editor/catalogProp.ts'
import { PropSwatch, TileSwatch } from '../../world/editor/Swatches.tsx'
import { ToolController } from '../../world/editor/ToolController.ts'
import { emptyMapFile, MAP_KEY_REGEX, MAP_LIMITS, parseMapFile, serializeMapFile, type MapFile } from '../../world/format/mapFile.ts'
import { removeProp, removeSeat, removeZone, resizeMap, setMeta, setSpawn, updateProp, updateSeat, updateZone } from '../../world/format/ops.ts'
import { listMapFiles } from '../../world/maps/index.ts'
import { WorldEngine } from '../../world/WorldEngine.ts'
import { WorldSession } from '../../world/WorldSession.ts'
import { DIRS, type Dir, type WorldMap } from '../../world/types.ts'

/**
 * DEV-ONLY map editor (route /dev/maps, not part of production builds).
 * Saving writes src/world/maps/data/<key>.map.json through the Vite dev server.
 */

const TOOLS: { id: ToolId; label: string; key: string; hint: string }[] = [
  { id: 'select', label: 'Select / move', key: 'V', hint: 'Click to select, drag to move. Zone corners resize. Delete removes.' },
  { id: 'paint', label: 'Paint', key: 'B', hint: 'Drag to paint tiles.' },
  { id: 'rect', label: 'Fill rectangle', key: 'R', hint: 'Drag a rectangle to fill it.' },
  { id: 'outline', label: 'Outline', key: 'O', hint: 'Drag a rectangle to draw its border only (walls!).' },
  { id: 'fill', label: 'Bucket', key: 'G', hint: 'Replace the connected region of one tile type.' },
  { id: 'pick', label: 'Eyedropper', key: 'I', hint: 'Click a tile to pick its type.' },
  { id: 'prop', label: 'Prop', key: 'P', hint: 'Click to place. Resizable props: drag to set the size.' },
  { id: 'seat', label: 'Seat', key: 'S', hint: 'Click to place a seat with the settings below.' },
  { id: 'zone', label: 'Audio zone', key: 'Z', hint: 'Drag a rectangle. Everyone inside hears each other.' },
  { id: 'spawn', label: 'Spawn point', key: 'N', hint: 'Click to set where people appear.' },
  { id: 'erase', label: 'Erase props/seats', key: 'X', hint: 'Click or drag over props and seats to remove them.' },
]
const TILE_TOOLS = new Set<ToolId>(['paint', 'rect', 'outline', 'fill'])

const API_HEADERS = { 'content-type': 'application/json', 'x-map-editor': '1' }

type Notice = { kind: 'ok' | 'error'; text: string } | null

function Field({ label, value, onCommit, type = 'text', min, max, disabled }: {
  label: string
  value: string | number
  onCommit: (v: string) => void
  type?: 'text' | 'number'
  min?: number
  max?: number
  disabled?: boolean
}) {
  // uncontrolled + keyed by value: typing never spams undo history, undo/redo still refreshes it
  return (
    <label className="me-field">
      <span>{label}</span>
      <input
        key={String(value)}
        type={type}
        defaultValue={value}
        min={min}
        max={max}
        disabled={disabled}
        onBlur={(e) => (e.currentTarget.value !== String(value) ? onCommit(e.currentTarget.value) : undefined)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="me-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

/** Walk around the map being edited, exactly as in a room (zones, collisions, seats). */
function PlayPreview({ map }: { map: WorldMap }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [zone, setZone] = useState<string | null>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const session = new WorldSession({ map, selfId: 'dev-tester' })
    const engine = new WorldEngine({ canvas, session, selfId: 'dev-tester', getSelf: () => ({ name: 'You', muted: false }), getPeers: () => ({}) })
    engine.start()
    const unsub = session.subscribe((h) => setZone(h.zoneName))
    return () => {
      unsub()
      engine.destroy()
      session.close()
    }
  }, [map])
  return (
    <div className="me-play">
      <canvas ref={ref} />
      <div className="me-play-hud">{zone ? `🔊 In zone: ${zone}` : '🌿 Open area'}. WASD / arrows / click to walk.</div>
    </div>
  )
}

export default function MapEditorPage() {
  const [model] = useState(() => {
    const first = listMapFiles().sort((a, b) => a.key.localeCompare(b.key))[0] ?? emptyMapFile('new-map', 'New map', 44, 32)
    return new EditorModel(first, listMapFiles().length ? first : null)
  })
  const [tools] = useState(() => new ToolController(model))
  const snap = useSyncExternalStore(model.subscribe, model.getSnapshot)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [mode, setMode] = useState<'edit' | 'play'>('edit')
  const [layers, setLayers] = useState<Layers>({ grid: true, zones: true, blocked: false })
  const [status, setStatus] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  // seeded from the build-time registry so the picker is right immediately; refreshed from disk below
  const [disk, setDisk] = useState<Record<string, MapFile>>(() => Object.fromEntries(listMapFiles().map((m) => [m.key, m])))
  const [diskError, setDiskError] = useState(false)
  const [panel, setPanel] = useState<'none' | 'new' | 'import'>('none')
  const [importText, setImportText] = useState('')
  const [newForm, setNewForm] = useState({ key: '', title: '', cols: 44, rows: 32, fill: DEFAULT_TILE.char })
  const [resizeTo, setResizeTo] = useState<{ cols: number; rows: number } | null>(null)

  const { map } = snap
  const errors = snap.issues.filter((i) => i.level === 'error')
  const warnings = snap.issues.filter((i) => i.level === 'warning')
  const onDisk = disk[map.key]

  // ---- load what is really on disk (the registry is build-time; this is live) ----
  useEffect(() => {
    fetch('/__dev/maps', { headers: API_HEADERS })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { maps: { key: string; map: MapFile | null }[] }) => setDisk(Object.fromEntries(d.maps.filter((m) => m.map).map((m) => [m.key, m.map!]))))
      .catch(() => setDiskError(true))
  }, [])

  // ---- canvas view lifecycle ----
  useEffect(() => {
    if (mode !== 'edit' || !canvasRef.current) return
    const view = new EditorView(canvasRef.current, model, tools, setStatus)
    viewRef.current = view
    view.start()
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [mode, model, tools])
  useEffect(() => {
    if (viewRef.current) viewRef.current.layers = layers
  }, [layers, mode])
  useEffect(() => {
    viewRef.current?.fit()
  }, [map.key, map.size.cols, map.size.rows, mode])

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) model.redo()
        else model.undo()
      } else if (mod && k === 'y') {
        e.preventDefault()
        model.redo()
      } else if (mod && k === 's') {
        e.preventDefault()
        void save()
      } else if (mod) return
      else if (k === 'delete' || k === 'backspace') {
        e.preventDefault()
        tools.deleteSelection()
      } else if (k === 'escape') {
        tools.cancel()
        model.select(null)
      } else if (k.startsWith('arrow') && model.getSnapshot().selection) {
        e.preventDefault()
        tools.nudge(k === 'arrowleft' ? -1 : k === 'arrowright' ? 1 : 0, k === 'arrowup' ? -1 : k === 'arrowdown' ? 1 : 0)
      } else {
        const tool = TOOLS.find((x) => x.key.toLowerCase() === k)
        if (tool) model.set({ tool: tool.id })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- save only reads from the model/state refs it closes over at call time
  }, [model, tools])

  // ---- warn before losing unsaved work ----
  useEffect(() => {
    if (!snap.dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [snap.dirty])

  // ---- file actions ----
  async function save() {
    const current = model.getSnapshot().map
    try {
      const res = await fetch(`/__dev/maps/${encodeURIComponent(current.key)}`, { method: 'PUT', headers: API_HEADERS, body: JSON.stringify(current) })
      const data = (await res.json()) as { ok?: boolean; issues?: { level: string; path: string; message: string }[]; error?: string }
      if (res.ok && data.ok) {
        model.markSaved()
        setDisk((d) => ({ ...d, [current.key]: current }))
        setNotice({ kind: 'ok', text: `Saved src/world/maps/data/${current.key}.map.json. Reload the app tab to see it in the room picker.` })
      } else {
        const errs = (data.issues ?? []).filter((i) => i.level === 'error')
        setNotice({ kind: 'error', text: `NOT saved: ${data.error ?? errs.map((i) => `${i.path}: ${i.message}`).join(' · ')}` })
      }
    } catch {
      setNotice({ kind: 'error', text: 'Cannot reach the dev save endpoint (it only accepts requests from this machine). Use Download instead.' })
    }
  }

  function openMap(key: string) {
    const target = disk[key]
    if (!target) return
    if (snap.dirty && !confirm('Discard unsaved changes?')) return
    model.load(target, target)
    setNotice(null)
  }

  function download() {
    const blob = new Blob([serializeMapFile(map)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${map.key}.map.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function doImport() {
    let raw: unknown
    try {
      raw = JSON.parse(importText)
    } catch (e) {
      return setNotice({ kind: 'error', text: `Not valid JSON: ${(e as Error).message}` })
    }
    const r = parseMapFile(raw)
    if (!r.map) return setNotice({ kind: 'error', text: r.issues.filter((i) => i.level === 'error').map((i) => `${i.path}: ${i.message}`).join(' · ') })
    model.load(r.map, disk[r.map.key] ?? null)
    setPanel('none')
    setImportText('')
    setNotice({ kind: 'ok', text: `Imported "${r.map.key}". Nothing is on disk until you press Save.` })
  }

  function createNew() {
    const { key, title, cols, rows, fill } = newForm
    if (!MAP_KEY_REGEX.test(key)) return setNotice({ kind: 'error', text: 'Key must be lowercase letters/digits/-/_ (max 32).' })
    if (disk[key]) return setNotice({ kind: 'error', text: `A map "${key}" already exists. Open it instead.` })
    if (cols < MAP_LIMITS.minSize || cols > MAP_LIMITS.maxSize || rows < MAP_LIMITS.minSize || rows > MAP_LIMITS.maxSize) return setNotice({ kind: 'error', text: `Size must be ${MAP_LIMITS.minSize}-${MAP_LIMITS.maxSize}.` })
    model.load(emptyMapFile(key, title || key, cols, rows, fill), null)
    setPanel('none')
    setNotice({ kind: 'ok', text: 'New map created (not saved yet). Build a room with Outline + Fill, add a zone, then Save.' })
  }

  // ---- inspector ----
  const sel: Selection = snap.selection
  const tool = TOOLS.find((t) => t.id === snap.tool)!
  const num = (v: string) => Number(v)
  const inspector = (() => {
    if (!sel) return <p className="hint">Nothing selected. Use the Select tool and click a prop, seat, zone or the spawn.</p>
    if (sel.kind === 'spawn') {
      return (
        <>
          <Field label="col" type="number" value={map.spawn[0]} onCommit={(v) => model.commit(setSpawn(map, num(v), map.spawn[1]))} />
          <Field label="row" type="number" value={map.spawn[1]} onCommit={(v) => model.commit(setSpawn(map, map.spawn[0], num(v)))} />
        </>
      )
    }
    if (sel.kind === 'prop') {
      const p = map.props[sel.index]
      if (!p) return null
      const d = propDef(p.type)!
      return (
        <>
          <p className="me-strong">{d.label}</p>
          <Field label="col" type="number" value={p.col} onCommit={(v) => model.commit(updateProp(map, sel.index, { col: num(v) }))} />
          <Field label="row" type="number" value={p.row} onCommit={(v) => model.commit(updateProp(map, sel.index, { row: num(v) }))} />
          {d.resize !== 'none' && <Field label="width" type="number" min={d.minW ?? 1} value={p.w ?? d.w} onCommit={(v) => model.commit(updateProp(map, sel.index, { w: Math.max(d.minW ?? 1, num(v)) }))} />}
          {d.resize === 'wh' && <Field label="height" type="number" min={d.minH ?? 1} value={p.h ?? d.h} onCommit={(v) => model.commit(updateProp(map, sel.index, { h: Math.max(d.minH ?? 1, num(v)) }))} />}
          {d.variants && (
            <label className="me-field">
              <span>variant</span>
              <select value={p.variant ?? d.variants[0]} onChange={(e) => model.commit(updateProp(map, sel.index, { variant: e.target.value }))}>
                {d.variants.map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
          )}
          {d.color && (
            <label className="me-field">
              <span>color</span>
              <input type="color" value={p.color ?? d.color} onChange={(e) => model.commit(updateProp(map, sel.index, { color: e.target.value }))} />
            </label>
          )}
          <label className="me-check">
            <input type="checkbox" checked={p.solid ?? d.solid} onChange={(e) => model.commit(updateProp(map, sel.index, { solid: e.target.checked }))} /> blocks walking
          </label>
          <button className="btn btn-outline" onClick={() => (model.select(null), model.commit(removeProp(map, sel.index)))}>Delete prop</button>
        </>
      )
    }
    if (sel.kind === 'seat') {
      const s = map.seats[sel.index]
      if (!s) return null
      return (
        <>
          <Field label="col" type="number" value={s.col} onCommit={(v) => model.commit(updateSeat(map, sel.index, { col: num(v) }))} />
          <Field label="row" type="number" value={s.row} onCommit={(v) => model.commit(updateSeat(map, sel.index, { row: num(v) }))} />
          <label className="me-field">
            <span>faces</span>
            <select value={s.dir} onChange={(e) => model.commit(updateSeat(map, sel.index, { dir: e.target.value as Dir }))}>{DIRS.map((d) => <option key={d}>{d}</option>)}</select>
          </label>
          <label className="me-field">
            <span>style</span>
            <select value={s.style} onChange={(e) => model.commit(updateSeat(map, sel.index, { style: e.target.value }))}>{SEAT_STYLES.map((d) => <option key={d}>{d}</option>)}</select>
          </label>
          <label className="me-field">
            <span>color</span>
            <input type="color" value={s.color ?? '#6366f1'} onChange={(e) => model.commit(updateSeat(map, sel.index, { color: e.target.value }))} />
          </label>
          <button className="btn btn-outline" onClick={() => (model.select(null), model.commit(removeSeat(map, sel.index)))}>Delete seat</button>
        </>
      )
    }
    const z = map.zones[sel.index]
    if (!z) return null
    const setRect = (i: number, v: string) => {
      const r = [...z.rect] as [number, number, number, number]
      r[i] = Math.round(num(v))
      model.commit(updateZone(map, sel.index, { rect: r }))
    }
    return (
      <>
        <Field label="name" value={z.name} onCommit={(v) => v.trim() && model.commit(updateZone(map, sel.index, { name: v.trim() }))} />
        <Field
          label="id"
          value={z.id}
          onCommit={(v) =>
            MAP_KEY_REGEX.test(v) && !map.zones.some((o, i) => i !== sel.index && o.id === v)
              ? model.commit(updateZone(map, sel.index, { id: v }))
              : setNotice({ kind: 'error', text: 'Zone id must be a unique lowercase slug.' })
          }
        />
        {(['col1', 'row1', 'col2', 'row2'] as const).map((l, i) => <Field key={l} label={l} type="number" value={z.rect[i]!} onCommit={(v) => setRect(i, v)} />)}
        <button className="btn btn-outline" onClick={() => (model.select(null), model.commit(removeZone(map, sel.index)))}>Delete zone</button>
      </>
    )
  })()

  const rs = resizeTo ?? { cols: map.size.cols, rows: map.size.rows }

  return (
    <div className="me">
      <header className="me-bar">
        <strong>Map editor</strong>
        <select value={onDisk ? map.key : ''} onChange={(e) => openMap(e.target.value)} aria-label="Open map">
          {!onDisk && <option value="">{map.key} (unsaved)</option>}
          {Object.keys(disk).sort().map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <button className="btn btn-outline" onClick={() => setPanel(panel === 'new' ? 'none' : 'new')}>New…</button>
        <button className="btn btn-outline" onClick={() => setPanel(panel === 'import' ? 'none' : 'import')}>Import JSON…</button>
        <span className="me-sep" />
        <button className="btn btn-outline" disabled={!snap.canUndo} onClick={() => model.undo()}>Undo</button>
        <button className="btn btn-outline" disabled={!snap.canRedo} onClick={() => model.redo()}>Redo</button>
        <span className="me-sep" />
        <button className="btn" onClick={() => void save()} disabled={diskError}>Save{snap.dirty ? ' •' : ''}</button>
        <button className="btn btn-outline" onClick={download}>Download</button>
        <button className="btn btn-outline" onClick={() => void navigator.clipboard.writeText(serializeMapFile(map)).then(() => setNotice({ kind: 'ok', text: 'JSON copied.' }))}>Copy JSON</button>
        {onDisk && snap.dirty && <button className="btn btn-outline" onClick={() => openMap(map.key)}>Revert</button>}
        <span className="me-sep" />
        <button className={mode === 'play' ? 'btn' : 'btn btn-outline'} onClick={() => setMode(mode === 'edit' ? 'play' : 'edit')}>{mode === 'edit' ? '▶ Play test' : '✎ Back to editing'}</button>
        <span className={`me-status ${errors.length ? 'bad' : warnings.length ? 'warn' : 'good'}`}>
          {errors.length} errors · {warnings.length} warnings
        </span>
      </header>

      {notice && <div className={`me-notice ${notice.kind}`} role="status">{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div>}
      {diskError && <div className="me-notice error">Cannot reach the dev save endpoint: Save is disabled. Use Download / Copy JSON and put the file in src/world/maps/data/.</div>}

      {panel === 'new' && (
        <div className="me-drawer">
          <Field label="key (file name)" value={newForm.key} onCommit={(v) => setNewForm({ ...newForm, key: v })} />
          <Field label="title" value={newForm.title} onCommit={(v) => setNewForm({ ...newForm, title: v })} />
          <Field label="cols" type="number" value={newForm.cols} onCommit={(v) => setNewForm({ ...newForm, cols: num(v) })} />
          <Field label="rows" type="number" value={newForm.rows} onCommit={(v) => setNewForm({ ...newForm, rows: num(v) })} />
          <label className="me-field">
            <span>fill with</span>
            <select value={newForm.fill} onChange={(e) => setNewForm({ ...newForm, fill: e.target.value })}>{TILESET.map((t) => <option key={t.char} value={t.char}>{t.name}</option>)}</select>
          </label>
          <button className="btn" onClick={createNew}>Create</button>
        </div>
      )}
      {panel === 'import' && (
        <div className="me-drawer col">
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="Paste a .map.json here (e.g. written by an AI). It is validated before anything changes." rows={8} />
          <button className="btn" onClick={doImport} disabled={!importText.trim()}>Validate &amp; load</button>
        </div>
      )}

      <aside className="me-left">
        <Section title="Tools">
          <div className="me-tools">
            {TOOLS.map((t) => (
              <button key={t.id} className={snap.tool === t.id ? 'me-tool on' : 'me-tool'} onClick={() => model.set({ tool: t.id })} title={t.hint}>
                {t.label} <kbd>{t.key}</kbd>
              </button>
            ))}
          </div>
          <p className="hint">{tool.hint}</p>
        </Section>

        {TILE_TOOLS.has(snap.tool) && (
          <Section title="Tiles">
            <div className="me-palette">
              {TILESET.map((t) => (
                <button key={t.id} className={snap.tile === t.char ? 'me-sw on' : 'me-sw'} onClick={() => model.set({ tile: t.char })} title={`${t.name} ("${t.char}")${t.solid ? ' - solid' : ''}`}>
                  <TileSwatch id={t.id} />
                  <small>{t.name}{t.solid ? ' ▪' : ''}</small>
                </button>
              ))}
            </div>
            {snap.tool === 'paint' && (
              <label className="me-field">
                <span>brush size</span>
                <select value={snap.brush} onChange={(e) => model.set({ brush: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}×{n}</option>)}</select>
              </label>
            )}
          </Section>
        )}

        {snap.tool === 'prop' && (
          <Section title="Props">
            <div className="me-palette">
              {PROP_CATALOG.filter((p) => !p.hidden).map((p) => (
                <button key={p.type} className={snap.propType === p.type ? 'me-sw on' : 'me-sw'} onClick={() => model.set({ propType: p.type })} title={`${p.label} ${p.w}×${p.h}${p.solid ? ' solid' : ' walk-through'}`}>
                  <PropSwatch prop={catalogProp(p.type, p.variants?.[0])} />
                  <small>{p.label}</small>
                </button>
              ))}
            </div>
            {propDef(snap.propType)?.variants && (
              <label className="me-field">
                <span>variant</span>
                <select value={snap.propVariant} onChange={(e) => model.set({ propVariant: e.target.value })}>{propDef(snap.propType)!.variants!.map((v) => <option key={v}>{v}</option>)}</select>
              </label>
            )}
          </Section>
        )}

        {snap.tool === 'seat' && (
          <Section title="Seat settings">
            <label className="me-field"><span>style</span><select value={snap.seatStyle} onChange={(e) => model.set({ seatStyle: e.target.value })}>{SEAT_STYLES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="me-field"><span>faces</span><select value={snap.seatDir} onChange={(e) => model.set({ seatDir: e.target.value as Dir })}>{DIRS.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="me-field"><span>color</span><input type="color" value={snap.seatColor} onChange={(e) => model.set({ seatColor: e.target.value })} /></label>
          </Section>
        )}

        <Section title="Layers">
          {(['grid', 'zones', 'blocked'] as const).map((k) => (
            <label key={k} className="me-check">
              <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {k === 'blocked' ? 'show blocked tiles (red)' : k}
            </label>
          ))}
        </Section>
      </aside>

      <main className="me-main">
        {mode === 'edit' ? <canvas ref={canvasRef} className="me-canvas" /> : <PlayPreview map={snap.world} />}
        <div className="me-statusbar">{mode === 'edit' ? `${status || 'hover the map'}   ·   wheel = zoom, right-drag / Space+drag = pan` : 'Play test: nothing here is saved or sent anywhere'}</div>
      </main>

      <aside className="me-right">
        <Section title="Map">
          <Field label="key" value={map.key} disabled onCommit={() => undefined} />
          <Field label="title" value={map.title} onCommit={(v) => v.trim() && model.commit(setMeta(map, { title: v.trim() }))} />
          <Field label="description" value={map.description ?? ''} onCommit={(v) => model.commit(setMeta(map, { description: v }))} />
          <div className="me-row">
            <Field label="cols" type="number" min={MAP_LIMITS.minSize} max={MAP_LIMITS.maxSize} value={rs.cols} onCommit={(v) => setResizeTo({ ...rs, cols: num(v) })} />
            <Field label="rows" type="number" min={MAP_LIMITS.minSize} max={MAP_LIMITS.maxSize} value={rs.rows} onCommit={(v) => setResizeTo({ ...rs, rows: num(v) })} />
          </div>
          <button
            className="btn btn-outline"
            disabled={rs.cols === map.size.cols && rs.rows === map.size.rows}
            onClick={() => {
              if (rs.cols < MAP_LIMITS.minSize || rs.rows < MAP_LIMITS.minSize || rs.cols > MAP_LIMITS.maxSize || rs.rows > MAP_LIMITS.maxSize) return setNotice({ kind: 'error', text: `Size must be ${MAP_LIMITS.minSize}-${MAP_LIMITS.maxSize}.` })
              model.commit(resizeMap(map, rs.cols, rs.rows, snap.tile))
              setResizeTo(null)
            }}
          >
            Resize (anchored top-left, new area = selected tile)
          </button>
        </Section>

        <Section title="Selected">{inspector}</Section>

        <Section title={`Zones (${map.zones.length})`}>
          {map.zones.length === 0 && <p className="hint">No zones: everyone hears by distance only.</p>}
          {map.zones.map((z, i) => (
            <button key={z.id} className={sel?.kind === 'zone' && sel.index === i ? 'me-list on' : 'me-list'} onClick={() => (model.set({ tool: 'select' }), model.select({ kind: 'zone', index: i }))}>
              {z.name} <small>[{z.rect.join(', ')}]</small>
            </button>
          ))}
          <button className="me-list" onClick={() => (model.set({ tool: 'select' }), model.select({ kind: 'spawn' }))}>Spawn <small>[{map.spawn.join(', ')}]</small></button>
        </Section>

        <Section title={`Problems (${errors.length} errors, ${warnings.length} warnings)`}>
          {snap.issues.length === 0 && <p className="hint">Nothing wrong. Walk it in Play test, then Save.</p>}
          <ul className="me-issues">
            {snap.issues.map((i, k) => <li key={k} className={i.level}><b>{i.path}</b> {i.message}</li>)}
          </ul>
        </Section>
      </aside>
    </div>
  )
}
