import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useRoomStore } from '../../store/room.store'
import { MapIcon, MaximizeIcon, MinimizeIcon, MoreIcon, UsersIcon, VolumeIcon, VolumeOffIcon } from '../Icons'

/**
 * The three-dot menu: the things you reach for now and then, kept off the bar so the bar stays about talking
 * (Chat, React, mic, Leave). Mic stays outside because you need it at a glance; sound moved in here, so the
 * button shows a red marker while you are deafened. A hidden "I can't hear anyone" state is how people end up
 * thinking the room is dead.
 */
export default function RoomMenu({
  count,
  onPeople,
  miniMap,
  canFullscreen,
  fullscreen,
  onFullscreen,
}: {
  /** people in the room, shown next to "People" */
  count: number
  onPeople: () => void
  /** only rooms with a map have a mini map; undefined hides the item */
  miniMap?: { visible: boolean; onToggle: () => void }
  canFullscreen: boolean
  fullscreen: boolean
  onFullscreen: () => void
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const deafened = useRoomStore((s) => s.deafened)
  const toggleDeafen = useRoomStore((s) => s.toggleDeafen)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  // focus the menu itself (no ring), so the arrow keys work right away without a ring flashing on the first item after a mouse click
  useEffect(() => {
    if (open) panel.current?.focus({ preventScroll: true })
  }, [open])

  function choose(action: () => void) {
    setOpen(false)
    action()
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      trigger.current?.focus()
      return
    }
    if (e.key === 'Tab') return setOpen(false) // let focus move on; the menu does not trap it
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    if (items.length === 0) return
    const at = items.indexOf(document.activeElement as HTMLElement)
    let next = -1
    if (e.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % items.length
    else if (e.key === 'ArrowUp') next = at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    if (next < 0) return
    e.preventDefault()
    items[next]?.focus()
  }

  return (
    <div className="rmenu" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className={`rbtn rbtn-icon ${open ? 'is-on' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={deafened ? 'More options (sound is off)' : 'More options'}
        title={deafened ? 'More (sound is off)' : 'More'}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreIcon size={20} />
        {deafened && (
          <span className="rdot" aria-hidden="true">
            <VolumeOffIcon size={9} strokeWidth={2.6} />
          </span>
        )}
      </button>

      {open && (
        <div className="rmenu-panel" role="menu" aria-label="More options" tabIndex={-1} ref={panel} onKeyDown={onKeyDown}>
          <MenuItem icon={<UsersIcon size={18} />} label="People" meta={count} onClick={() => choose(onPeople)} />
          <MenuItem
            icon={deafened ? <VolumeOffIcon size={18} /> : <VolumeIcon size={18} />}
            label={deafened ? 'Turn sound on' : 'Turn sound off'}
            onClick={() => choose(toggleDeafen)}
          />
          {miniMap && <MenuItem icon={<MapIcon size={18} />} label={miniMap.visible ? 'Hide mini map' : 'Show mini map'} onClick={() => choose(miniMap.onToggle)} />}
          {canFullscreen && (
            <MenuItem
              icon={fullscreen ? <MinimizeIcon size={18} /> : <MaximizeIcon size={18} />}
              label={fullscreen ? 'Exit full screen' : 'Full screen'}
              onClick={() => choose(onFullscreen)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, meta, onClick }: { icon: ReactNode; label: string; meta?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="rmenu-item" onClick={onClick}>
      {icon}
      <span>{label}</span>
      {meta !== undefined && <span className="rmenu-meta">{meta}</span>}
    </button>
  )
}
