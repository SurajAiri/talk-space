import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { GripIcon, XIcon } from '../Icons'

interface Pos {
  x: number
  y: number
}

const MARGIN = 10
const TOP_MIN = 10
let zCounter = 40

const storeKey = (id: string) => `ts.panel.${id}`

function load(id: string): Pos | null {
  try {
    const raw = localStorage.getItem(storeKey(id))
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Pos>
    return typeof p.x === 'number' && typeof p.y === 'number' ? { x: p.x, y: p.y } : null
  } catch {
    return null
  }
}
function save(id: string, p: Pos) {
  try {
    localStorage.setItem(storeKey(id), JSON.stringify(p))
  } catch {
    /* private mode: it just won't be remembered */
  }
}

/**
 * A window that floats over the map. Drag it by its title bar (mouse or finger); where you leave it
 * is remembered. It always keeps its title bar on screen, so it can never be lost.
 */
export default function FloatPanel({
  id,
  title,
  icon,
  onClose,
  width = 340,
  height = 520,
  fit = false,
  anchor = 'right',
  topOffset = 64,
  headerExtra,
  children,
}: {
  id: string
  title: string
  icon?: ReactNode
  onClose: () => void
  width?: number
  height?: number
  /** shrink to the content (up to `height`) instead of always being `height` tall */
  fit?: boolean
  /** where it first appears; after that, wherever it was last dropped */
  anchor?: 'right' | 'left'
  /** clear the top bar */
  topOffset?: number
  headerExtra?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  const [pos, setPos] = useState<Pos>(() => {
    // first placement: where it was last left, else on its side under the top bar. Never off screen.
    const w = Math.min(width, window.innerWidth - MARGIN * 2)
    const start = load(id) ?? { x: anchor === 'right' ? window.innerWidth - w - 14 : 14, y: topOffset }
    return {
      x: Math.min(Math.max(start.x, MARGIN), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
      y: Math.min(Math.max(start.y, TOP_MIN), Math.max(TOP_MIN, window.innerHeight - 52)),
    }
  })
  const [z, setZ] = useState(() => ++zCounter)
  const drag = useRef<{ dx: number; dy: number; id: number } | null>(null)

  const clamp = useCallback((p: Pos): Pos => {
    const w = ref.current?.offsetWidth ?? width
    const vw = window.innerWidth
    const vh = window.innerHeight
    return {
      x: Math.min(Math.max(p.x, MARGIN), Math.max(MARGIN, vw - w - MARGIN)),
      y: Math.min(Math.max(p.y, TOP_MIN), Math.max(TOP_MIN, vh - 52)), // title bar stays reachable
    }
  }, [width])

  // rotating a phone or resizing the window must not strand the panel off screen
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clamp])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.contains(document.activeElement)) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function onDown(e: ReactPointerEvent<HTMLElement>) {
    setZ(++zCounter)
    if ((e.target as HTMLElement).closest('button, select, input, a')) return
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onMove(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }))
  }
  function onUp(e: ReactPointerEvent<HTMLElement>) {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    save(id, pos)
  }

  return (
    <section
      ref={ref}
      className="float"
      role="dialog"
      aria-label={title}
      style={{
        width: `min(${width}px, calc(100vw - ${MARGIN * 2}px))`,
        [fit ? 'maxHeight' : 'height']: `min(${height}px, calc(100dvh - ${topOffset + 14}px))`,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        zIndex: z,
      }}
      onPointerDownCapture={() => setZ(++zCounter)}
    >
      <header className="float-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span className="float-grip" aria-hidden="true">
          <GripIcon size={16} />
        </span>
        <h2 className="float-title">
          {icon}
          {title}
        </h2>
        <span className="float-extra">{headerExtra}</span>
        <button type="button" className="btn btn-ghost btn-icon btn-small" aria-label={`Close ${title}`} onClick={onClose}>
          <XIcon size={16} />
        </button>
      </header>
      <div className="float-body">{children}</div>
    </section>
  )
}
