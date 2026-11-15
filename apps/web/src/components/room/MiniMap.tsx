import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { hearingGain } from '../../world/hearing'
import { mapThumbnail } from '../../world/thumbnail'
import type { WorldSession } from '../../world/WorldSession'
import { MapIcon, XIcon } from '../Icons'

const KEY = 'ts.minimap'
/** Largest the card gets, in CSS px: wide maps are limited by width, tall ones by height. */
const MAX_W = 208
const MAX_H = 168

function initiallyOpen(): boolean {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'on') return true
    if (v === 'off') return false
  } catch {
    /* private mode: fall through to the default */
  }
  // a phone's corners are busy and its screen small: start closed there, open on a laptop
  return !window.matchMedia('(pointer: coarse)').matches
}

/**
 * The whole map in a corner. It reuses the map's own picture, and draws on top: the part you are looking at,
 * the audio zones, you (white) and everyone else (green when you can hear them, grey when you can't).
 * Click or tap it to walk to that spot. It only reads the world session, exactly like the engine does.
 */
export default function MiniMap({ session }: { session: WorldSession }) {
  const map = session.map
  const [open, setOpen] = useState(initiallyOpen)
  const overlay = useRef<HTMLCanvasElement>(null)
  const image = mapThumbnail(map, MAX_W * 2)

  const aspect = map.cols / map.rows
  const width = Math.round(Math.min(MAX_W, MAX_H * aspect))

  function toggle(next: boolean) {
    setOpen(next)
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off')
    } catch {
      /* it just won't be remembered */
    }
  }

  useEffect(() => {
    const canvas = overlay.current
    const g = canvas?.getContext('2d')
    if (!open || !canvas || !g) return
    let raf = 0
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr)
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const sx = w / map.cols
      const sy = h / map.rows

      g.lineWidth = 1
      g.setLineDash([3, 3])
      g.strokeStyle = 'rgba(255, 255, 255, 0.4)'
      for (const z of map.zones) g.strokeRect(z.rect.c1 * sx + 0.5, z.rect.r1 * sy + 0.5, (z.rect.c2 - z.rect.c1 + 1) * sx - 1, (z.rect.r2 - z.rect.r1 + 1) * sy - 1)
      g.setLineDash([])

      const vp = session.viewport
      if (vp.w > 0) {
        g.fillStyle = 'rgba(255, 255, 255, 0.08)'
        g.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        g.lineWidth = 1.5
        g.beginPath()
        g.rect((vp.x - vp.w / 2) * sx, (vp.y - vp.h / 2) * sy, vp.w * sx, vp.h * sy)
        g.fill()
        g.stroke()
      }

      for (const r of session.remotes.values()) {
        g.fillStyle = hearingGain(map, session.local, r) > 0 ? '#34d39b' : 'rgba(200, 208, 230, 0.7)'
        g.strokeStyle = 'rgba(11, 17, 37, 0.8)'
        g.lineWidth = 1.5
        g.beginPath()
        g.arc(r.x * sx, r.y * sy, 3.4, 0, Math.PI * 2)
        g.fill()
        g.stroke()
      }

      const me = session.local
      g.fillStyle = '#ffffff'
      g.strokeStyle = '#3454f0'
      g.lineWidth = 2.5
      g.beginPath()
      g.arc(me.x * sx, me.y * sy, 4.2, 0, Math.PI * 2)
      g.stroke()
      g.fill()
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [open, session, map])

  function walkHere(e: ReactPointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const col = Math.floor(((e.clientX - r.left) / r.width) * map.cols)
    const row = Math.floor(((e.clientY - r.top) / r.height) * map.rows)
    if (col >= 0 && row >= 0 && col < map.cols && row < map.rows) session.requestWalk(col, row)
  }

  if (!open) {
    return (
      <button type="button" className="minimap-toggle" onClick={() => toggle(true)} aria-label="Show the mini map" title="Show the mini map">
        <MapIcon size={20} />
      </button>
    )
  }

  return (
    <div className="minimap" style={{ width }}>
      {image && <img className="minimap-img" src={image} alt="" draggable={false} style={{ aspectRatio: `${map.cols} / ${map.rows}` }} />}
      <canvas ref={overlay} className="minimap-overlay" onPointerDown={walkHere} role="img" aria-label={`Mini map of ${map.title}. Click a spot to walk there.`} title="Click to walk there" />
      <button type="button" className="minimap-close" onClick={() => toggle(false)} aria-label="Hide the mini map" title="Hide the mini map">
        <XIcon size={14} />
      </button>
    </div>
  )
}
