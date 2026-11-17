import { useEffect, useRef } from 'react'
import { emoteById } from '../world/fx'
import type { Look } from '../world/avatar'
import { drawCharacter } from '../world/render/character'
import type { Character, Dir } from '../world/types'

/**
 * A character drawn by the same code the room uses, so what you design is exactly what people see.
 * `head` crops to the face (for option tiles). `animate` gives the idle bob; an emote plays whenever
 * `emote.key` changes. Nothing moves for people who asked their system for less motion, except an emote
 * they just pressed.
 */
export default function CharacterCanvas({
  look,
  size = 120,
  dir = 'down',
  animate = false,
  head = false,
  emote = null,
  label,
  className,
}: {
  look: Look
  /** CSS px, square */
  size?: number
  dir?: Dir
  animate?: boolean
  head?: boolean
  emote?: { id: string; key: number } | null
  /** read out by screen readers; omit for decoration */
  label?: string
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const startedAt = useRef<{ key: number; at: number } | null>(null)
  const props = useRef({ look, dir, head, emote, animate })

  // restart the emote clock whenever a new emote is requested
  useEffect(() => {
    if (emote) startedAt.current = { key: emote.key, at: performance.now() }
  }, [emote])

  useEffect(() => {
    const canvas = ref.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let stopped = false

    const frame = (now: number) => {
      if (stopped) return
      const p = props.current
      const char: Character = {
        id: 'preview',
        name: '',
        flair: '',
        status: 'available',
        isPlayer: false,
        x: 0,
        y: 0,
        dir: p.dir,
        moving: false,
        walkFrame: 0,
        dancing: false,
        sittingSeat: null,
        ...p.look,
        speechBubble: null,
        reaction: null,
        emote: null,
      }
      let playing = false
      const s = startedAt.current
      const def = p.emote && s && s.key === p.emote.key ? emoteById(p.emote.id) : undefined
      if (def && s && now - s.at < def.ms) {
        char.emote = { id: def.id, age: now - s.at }
        playing = true
      }

      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, size, size)
      const k = p.head ? size / 38 : size / 66
      g.translate(size / 2, p.head ? size / 2 + 19 * k : size * 0.66)
      g.scale(k, k)
      drawCharacter(g, char, 0, 0, 1, calm && !playing ? 0 : now)
      if ((p.animate && !calm) || playing) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const wake = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(frame)
    }
    // static pictures only redraw when something about them changes (see the effect below)
    canvas.addEventListener('redraw', wake)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      canvas.removeEventListener('redraw', wake)
    }
  }, [size])

  // draw again when what is shown changes (the loop above has already stopped for a static picture)
  useEffect(() => {
    props.current = { look, dir, head, emote, animate }
    ref.current?.dispatchEvent(new Event('redraw'))
  }, [look, dir, head, emote, animate])

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}
