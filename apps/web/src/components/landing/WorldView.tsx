import { useEffect, useRef } from 'react'
import { appearanceFor } from '../../world/appearance'
import { hearingGain, HEARING, zoneAt } from '../../world/hearing'
import { findPath, isTileBlocked } from '../../world/navigation'
import type { Waypoint } from '../../world/navigation'
import { drawProp } from '../../world/assets/props'
import { drawTile } from '../../world/assets/tiles'
import { drawCharacter, drawCharacterOverlays } from '../../world/render/character'
import { loadWorldMap } from '../../world/maps'
import { TILE } from '../../world/types'
import type { Character, Dir, WorldMap } from '../../world/types'

/**
 * A small, self-running window into a real Talk Space map for the landing page.
 * It reuses the room's own art (tiles, props, avatars, name tags, speech bubbles), its pathfinding
 * and its hearing rules, but owns no networking or audio. Everything below is drawn on one canvas.
 */

export interface ActorSpec {
  id: string
  name: string
  /** where this person stands (tile coordinates) */
  col: number
  row: number
  /** the one the visitor steers, and the one the hearing rings are drawn around */
  you?: boolean
  /** speech bubble text, shown now and then while someone can hear it */
  say?: string
  /** wander within this many tiles of (col,row) */
  wander?: number
}

export interface Camera {
  col: number
  row: number
  /** how many tiles fit across the view (phones are capped so people stay big enough) */
  across: number
}

export interface Heard {
  id: string
  name: string
  pct: number
  color: string
}

export interface HeardState {
  zone: string | null
  heard: Heard[]
}

interface ViewProps {
  mapKey: string
  camera: Camera
  actors: ActorSpec[]
  /** camera follows "You" instead of sitting still */
  followYou?: boolean
  rings?: boolean
  zones?: boolean
  activeZone?: string | null
  /** mouse / touch / arrow keys walk "You" */
  steer?: boolean
  onHeard?: (state: HeardState) => void
  onInteract?: () => void
  label: string
  className?: string
}

interface Runtime {
  spec: ActorSpec
  x: number
  y: number
  path: Waypoint[]
  dir: Dir
  moving: boolean
  walkFrame: number
  nextWander: number
  sayIn: number
  bubble: Character['speechBubble']
  look: ReturnType<typeof appearanceFor>
  gain: number
}

const UI_FONT = "'Instrument Sans Variable', system-ui, sans-serif"
const TAU = Math.PI * 2
const SPEED = 150 // px per second, about 3 tiles
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The ground and props never change, so each map is painted once and then just blitted. */
const baked = new Map<string, HTMLCanvasElement>()
function bake(map: WorldMap): HTMLCanvasElement {
  const hit = baked.get(map.key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = map.cols * TILE
  c.height = map.rows * TILE
  const g = c.getContext('2d')
  if (g) {
    for (let r = 0; r < map.rows; r++) {
      const row = map.grid[r]
      if (!row) continue
      for (let col = 0; col < map.cols; col++) {
        const id = row[col]
        if (id !== undefined) drawTile(g, id, col, r, 0)
      }
    }
    for (const p of [...map.props].sort((a, b) => a.row + a.h - (b.row + b.h))) drawProp(g, p, 0)
  }
  baked.set(map.key, c)
  return c
}

/** The closest walkable tile to a wished-for spot, so a scene never parks someone inside a wall. */
function nearestFree(map: WorldMap, col: number, row: number) {
  const c0 = Math.floor(col)
  const r0 = Math.floor(row)
  for (let d = 0; d <= 8; d++) {
    for (let dr = -d; dr <= d; dr++) {
      for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== d) continue
        if (!isTileBlocked(map, c0 + dc, r0 + dr)) return { col: c0 + dc, row: r0 + dr }
      }
    }
  }
  return { col: c0, row: r0 }
}

interface Engine {
  retarget: (specs: ActorSpec[]) => void
}

export default function WorldView(props: ViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef<ViewProps>(props)
  const engineRef = useRef<Engine | null>(null)

  // the loop reads the latest props from here instead of restarting on every render
  useEffect(() => {
    propsRef.current = props
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const map = loadWorldMap(props.mapKey)
    const g = canvas?.getContext('2d')
    if (!canvas || !map || !g) return
    const world = bake(map)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const actors = new Map<string, Runtime>()
    const cam = { col: 0, row: 0, across: 20, ready: false }
    const view = { scale: 1, ox: 0, oy: 0 }
    let cssW = 0
    let cssH = 0
    let dpr = 1
    let raf = 0
    let last = 0
    let clock = 0
    let visible = true
    let placed = false
    let heardKey = ''
    let steerKey = ''
    let steerAt = 0
    let interacted = false

    const you = () => [...actors.values()].find((a) => a.spec.you)
    const tileOf = (a: Runtime) => ({ col: Math.floor(a.x / TILE), row: Math.floor(a.y / TILE) })

    const retarget = (specs: ActorSpec[]) => {
      const snap = !placed || reduced
      placed = true
      const ids = new Set(specs.map((s) => s.id))
      for (const id of [...actors.keys()]) if (!ids.has(id)) actors.delete(id)
      for (const spec of specs) {
        const dest = nearestFree(map, spec.col, spec.row)
        const cx = (dest.col + 0.5) * TILE
        const cy = (dest.row + 0.5) * TILE
        const a = actors.get(spec.id)
        if (!a) {
          actors.set(spec.id, {
            spec, x: cx, y: cy, path: [], dir: 'down', moving: false, walkFrame: 0,
            nextWander: 2 + Math.random() * 3, sayIn: 1.5 + Math.random() * 3, bubble: null,
            look: appearanceFor(spec.id), gain: 1,
          })
          continue
        }
        a.spec = spec
        if (snap) {
          a.x = cx
          a.y = cy
          a.path = []
        } else {
          a.path = findPath(map, tileOf(a), dest) ?? []
        }
      }
    }
    engineRef.current = { retarget }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      cssW = canvas.clientWidth
      cssH = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(cssW * dpr))
      canvas.height = Math.max(1, Math.round(cssH * dpr))
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    const io = new IntersectionObserver((e) => { visible = Boolean(e[0]?.isIntersecting) }, { threshold: 0.01 })
    io.observe(canvas)

    /* ----- steering: walk toward the pointer or with the arrow keys ----- */
    const steerTo = (col: number, row: number) => {
      const p = propsRef.current
      const me = you()
      if (!p.steer || !me) return
      const key = `${col},${row}`
      const now = performance.now()
      if (key === steerKey || now - steerAt < 90) return
      const path = findPath(map, tileOf(me), nearestFree(map, col, row))
      if (!path) return
      me.path = path
      steerKey = key
      steerAt = now
      if (!interacted) {
        interacted = true
        p.onInteract?.()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.type !== 'pointerdown') return
      const r = canvas.getBoundingClientRect()
      const wx = (e.clientX - r.left - view.ox) / view.scale
      const wy = (e.clientY - r.top - view.oy) / view.scale
      steerTo(Math.floor(wx / TILE), Math.floor(wy / TILE))
    }
    const onKey = (e: KeyboardEvent) => {
      const me = you()
      const d: Record<string, [number, number]> = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] }
      const delta = d[e.key]
      if (!me || !delta) return
      e.preventDefault()
      const t = tileOf(me)
      steerTo(t.col + delta[0], t.row + delta[1])
    }
    canvas.addEventListener('pointermove', onPointer)
    canvas.addEventListener('pointerdown', onPointer)
    canvas.addEventListener('keydown', onKey)

    /* ----- one frame ----- */
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible || cssW === 0) {
        last = 0
        return
      }
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016
      last = t
      clock += dt
      const p = propsRef.current
      const me = you()

      // people: walk, wander, speak
      for (const a of actors.values()) {
        a.moving = false
        const wp = a.path[0]
        if (wp) {
          const dx = wp.x - a.x
          const dy = wp.y - a.y
          const dist = Math.hypot(dx, dy)
          const step = SPEED * dt
          if (dist <= step) {
            a.x = wp.x
            a.y = wp.y
            a.path.shift()
          } else {
            a.x += (dx / dist) * step
            a.y += (dy / dist) * step
          }
          a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
          a.moving = true
          a.walkFrame += dt * 60
        } else if (!reduced && a.spec.wander && clock > a.nextWander) {
          const w = a.spec.wander
          const dest = nearestFree(map, a.spec.col + (Math.random() * 2 - 1) * w, a.spec.row + (Math.random() * 2 - 1) * w)
          a.path = findPath(map, tileOf(a), dest) ?? []
          a.nextWander = clock + 3 + Math.random() * 4
        }
        if (a.spec.say) {
          a.sayIn -= dt
          if (a.sayIn <= 0) {
            a.bubble = { text: a.spec.say, dm: false, age: 0, timer: 4600 }
            a.sayIn = 9 + Math.random() * 4
          }
        }
        if (a.bubble) {
          a.bubble.age += dt * 1000
          a.bubble.timer -= dt * 1000
          if (a.bubble.timer <= 0) a.bubble = null
        }
      }

      // who hears whom (the product's own rules)
      const meTile = me ? { x: me.x / TILE, y: me.y / TILE } : null
      for (const a of actors.values()) {
        a.gain = meTile && a !== me ? hearingGain(map, meTile, { x: a.x / TILE, y: a.y / TILE }) : 1
      }
      const myZone = meTile ? zoneAt(map, meTile.x, meTile.y) : null
      if (p.onHeard && me) {
        const heard = [...actors.values()]
          .filter((a) => a !== me && a.gain > 0)
          .sort((a, b) => b.gain - a.gain)
          .map((a) => ({ id: a.spec.id, name: a.spec.name, pct: Math.round(a.gain * 100), color: a.look.shirt }))
        const key = `${myZone?.id ?? ''}|${heard.map((h) => `${h.id}:${h.pct}`).join(',')}`
        if (key !== heardKey) {
          heardKey = key
          p.onHeard({ zone: myZone?.name ?? null, heard })
        }
      }

      // camera
      const across = cssW < 640 ? Math.min(p.camera.across, 12) : p.camera.across
      const k = cam.ready ? 1 - Math.exp(-dt * 3.2) : 1
      cam.across += (across - cam.across) * k
      const viewW = cam.across
      const viewH = cssH / (cssW / cam.across)
      const target = p.followYou && me ? { col: me.x / TILE, row: me.y / TILE } : { col: p.camera.col, row: p.camera.row }
      const tc = viewW >= map.cols ? map.cols / 2 : clamp(target.col, viewW / 2, map.cols - viewW / 2)
      const tr = viewH >= map.rows ? map.rows / 2 : clamp(target.row, viewH / 2, map.rows - viewH / 2)
      cam.col += (tc - cam.col) * k
      cam.row += (tr - cam.row) * k
      cam.ready = true

      const scale = cssW / cam.across / TILE
      view.scale = scale
      view.ox = cssW / 2 - cam.col * TILE * scale
      view.oy = cssH / 2 - cam.row * TILE * scale
      const os = clamp(1 / scale, 1, 1.9) // name tags stay readable when zoomed out
      const time = t

      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, canvas.width, canvas.height)
      g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * view.ox, dpr * view.oy)
      g.imageSmoothingEnabled = true
      g.imageSmoothingQuality = 'high'
      g.drawImage(world, 0, 0)

      // zones: dashed outline + name, tinted when it is the one in focus
      if (p.zones) {
        for (const z of map.zones) {
          const { c1, r1, c2, r2 } = z.rect
          const x = c1 * TILE
          const y = r1 * TILE
          const w = (c2 - c1 + 1) * TILE
          const h = (r2 - r1 + 1) * TILE
          const on = p.activeZone === z.id || myZone?.id === z.id
          if (on) {
            g.fillStyle = 'rgba(52, 84, 240, 0.16)'
            g.fillRect(x, y, w, h)
          }
          g.setLineDash([12 / scale, 8 / scale])
          g.strokeStyle = on ? '#ffffff' : 'rgba(255, 255, 255, 0.78)'
          g.lineWidth = (on ? 3.5 : 2.5) / scale
          g.strokeRect(x + 2, y + 2, w - 4, h - 4)
          g.setLineDash([])
          g.font = `700 ${12 / scale}px ${UI_FONT}`
          const tw = g.measureText(z.name).width
          const ph = 22 / scale
          const pw = tw + 16 / scale
          g.fillStyle = on ? '#3454f0' : 'rgba(14, 18, 32, 0.86)'
          g.beginPath()
          g.roundRect(x + 8 / scale, y + 8 / scale, pw, ph, 6 / scale)
          g.fill()
          g.fillStyle = '#fff'
          g.textAlign = 'left'
          g.textBaseline = 'middle'
          g.fillText(z.name, x + 16 / scale, y + 8 / scale + ph / 2 + 0.5 / scale)
        }
      }

      // hearing range around "You" (only in the open: inside a zone, everyone in it hears everyone)
      if (p.rings && me && !myZone) {
        g.beginPath()
        g.arc(me.x, me.y, HEARING.fullRadius * TILE, 0, TAU)
        g.fillStyle = 'rgba(52, 84, 240, 0.2)'
        g.fill()
        g.strokeStyle = 'rgba(255, 255, 255, 0.95)'
        g.lineWidth = 2.5 / scale
        g.stroke()
        g.beginPath()
        g.arc(me.x, me.y, HEARING.maxRadius * TILE, 0, TAU)
        g.setLineDash([10 / scale, 10 / scale])
        g.strokeStyle = 'rgba(255, 255, 255, 0.75)'
        g.lineWidth = 2 / scale
        g.stroke()
        g.setLineDash([])
        if (!reduced) {
          const q = (time / 3200) % 1
          g.beginPath()
          g.arc(me.x, me.y, q * HEARING.maxRadius * TILE, 0, TAU)
          g.strokeStyle = `rgba(255, 255, 255, ${0.55 * (1 - q)})`
          g.lineWidth = 2 / scale
          g.stroke()
        }
      }

      // people, back to front
      const people = [...actors.values()].sort((a, b) => a.y - b.y)
      const drawn: { a: Runtime; ch: Character }[] = []
      for (const a of people) {
        const ch: Character = {
          id: a.spec.id, name: a.spec.name, flair: '', status: 'available', isPlayer: Boolean(a.spec.you),
          x: a.x, y: a.y, dir: a.dir, moving: a.moving, walkFrame: a.walkFrame, dancing: false, sittingSeat: null,
          ...a.look,
          speechBubble: a.bubble && a.gain > 0.15 ? a.bubble : null,
          reaction: null,
        }
        g.globalAlpha = a === me ? 1 : 0.55 + 0.45 * a.gain
        drawCharacter(g, ch, a.x, a.y, 1, time)
        drawn.push({ a, ch })
      }
      g.globalAlpha = 1
      for (const { a, ch } of drawn) {
        drawCharacterOverlays(g, ch, time, os)
        if (a === me) continue
        const audible = a.gain > 0.005
        const label = audible ? `${Math.round(a.gain * 100)}%` : 'out of earshot'
        g.save()
        g.translate(a.x, a.y + 30 * os)
        g.scale(os, os)
        g.font = `700 11px ${UI_FONT}`
        const w = g.measureText(label).width + 16
        g.fillStyle = 'rgba(255, 255, 255, 0.94)'
        g.beginPath()
        g.roundRect(-w / 2, -9, w, 18, 9)
        g.fill()
        g.fillStyle = audible ? '#0b7a53' : '#5b6479'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(label, 0, 0.5)
        g.restore()
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      canvas.removeEventListener('pointermove', onPointer)
      canvas.removeEventListener('pointerdown', onPointer)
      canvas.removeEventListener('keydown', onKey)
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the engine is rebuilt only when the map changes
  }, [props.mapKey])

  // a new scene (different spots for the same people) makes them walk there
  const sceneKey = props.actors.map((a) => `${a.id}:${a.col}:${a.row}:${a.you ? 1 : 0}:${a.say ?? ''}:${a.wander ?? 0}`).join('|')
  useEffect(() => {
    engineRef.current?.retarget(props.actors)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the scene's content, not array identity
  }, [sceneKey, props.mapKey])

  return (
    <canvas
      ref={canvasRef}
      className={props.className}
      role="img"
      aria-label={props.label}
      tabIndex={props.steer ? 0 : undefined}
    />
  )
}
