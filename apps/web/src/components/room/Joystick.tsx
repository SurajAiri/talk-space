import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { WorldSession } from '../../world/WorldSession'

const RADIUS = 44 // how far the knob can travel from the centre, in px

/**
 * On-screen thumbstick for touch screens. It only writes a -1..1 vector into the world session;
 * the engine decides what that means (speed, direction), exactly like the keyboard.
 */
export default function Joystick({ session }: { session: WorldSession }) {
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const active = useRef<number | null>(null)

  const reset = () => {
    active.current = null
    session.setJoystick(0, 0)
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)'
    base.current?.classList.remove('is-active')
  }
  // never leave the avatar running if the stick disappears mid-gesture (rotation, panel opening)
  useEffect(() => reset, []) // eslint-disable-line react-hooks/exhaustive-deps

  function follow(e: ReactPointerEvent) {
    const el = base.current
    if (!el) return
    const r = el.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS
      dy = (dy / d) * RADIUS
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`
    session.setJoystick(dx / RADIUS, dy / RADIUS)
  }

  return (
    <div
      ref={base}
      className="joystick"
      role="application"
      aria-label="Movement joystick"
      onPointerDown={(e) => {
        if (active.current !== null) return
        active.current = e.pointerId
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.classList.add('is-active')
        follow(e)
      }}
      onPointerMove={(e) => active.current === e.pointerId && follow(e)}
      onPointerUp={(e) => active.current === e.pointerId && reset()}
      onPointerCancel={(e) => active.current === e.pointerId && reset()}
      onLostPointerCapture={reset}
    >
      <span className="joystick-ring" aria-hidden="true" />
      <div ref={knob} className="joystick-knob" aria-hidden="true" />
    </div>
  )
}
