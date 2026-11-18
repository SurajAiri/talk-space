import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { usePeerFollow } from '../../hooks/useFollow'
import { placeMenu, type MenuAnchor } from '../../lib/menuAnchor'
import { useRoomStore } from '../../store/room.store'
import type { WorldSession } from '../../world/WorldSession'
import { ArrowRightIcon, BanIcon, ChatIcon, FollowIcon, PauseIcon, PlayIcon, XIcon } from '../Icons'

/**
 * What you can do with a person you clicked in the world: ask to follow them (or answer, pause, stop), walk over to
 * them, message them. Their name comes from the room's member list, never from anything a peer sent.
 */
export default function CharacterMenu({
  anchor,
  session,
  onClose,
  onMessage,
}: {
  anchor: MenuAnchor
  session: WorldSession
  onClose: () => void
  onMessage?: (peerId: string) => void
}) {
  const id = anchor.id
  const name = useRoomStore((s) => s.peers[id]?.name)
  const f = usePeerFollow(id)
  const panel = useRef<HTMLDivElement>(null)

  // Put it where it fits, using its REAL size (the number of items changes with the follow state, and so does the
  // screen). Runs after every render and before the screen is painted, so it never shows in the wrong place.
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const view = { w: document.documentElement.clientWidth, h: window.innerHeight }
    const { left, top } = placeMenu({ x: anchor.x, y: anchor.y }, { w: el.offsetWidth, h: el.offsetHeight }, view)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  })
  // turning the phone or resizing the window moves everything: close it rather than leave it stranded
  useEffect(() => {
    window.addEventListener('resize', onClose)
    return () => window.removeEventListener('resize', onClose)
  }, [onClose])

  // a click anywhere else closes it (and still does what it was for: walking, say)
  useEffect(() => {
    // The mouse opens this menu on the press itself, and that same press may still be on its way up to `window`:
    // anything stamped before now is the press that opened it, not a click elsewhere.
    const since = performance.now()
    const onDown = (e: PointerEvent) => e.timeStamp > since && !panel.current?.contains(e.target as Node) && onClose()
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [onClose])
  useEffect(() => {
    panel.current?.focus({ preventScroll: true })
  }, [])
  // they left while the menu was open
  useEffect(() => {
    if (name === undefined) onClose()
  }, [name, onClose])

  if (name === undefined) return null

  const choose = (action: () => void) => () => {
    onClose()
    action()
  }
  function walkOver() {
    const r = session.remotes.get(id)
    if (r) session.requestWalk(Math.floor(r.x), Math.floor(r.y))
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      return onClose()
    }
    if (e.key === 'Tab') return onClose()
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    const at = items.indexOf(document.activeElement as HTMLElement)
    let next = -1
    if (e.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % items.length
    else if (e.key === 'ArrowUp') next = at < 0 ? items.length - 1 : (at - 1 + items.length) % items.length
    if (next < 0) return
    e.preventDefault()
    items[next]?.focus()
  }

  return (
    <div className="cmenu" role="menu" aria-label={`Actions for ${name}`} tabIndex={-1} ref={panel} onKeyDown={onKeyDown}>
      <div className="cmenu-head">{name}</div>

      {f.blocked ? (
        <p className="cmenu-note">You blocked {name}. Unblock them in the people list to interact.</p>
      ) : (
        f.available && (
          <>
            {f.theyAsked && (
              <>
                <Item icon={<FollowIcon size={18} />} label="Accept: let them follow me" onClick={choose(f.accept)} />
                <Item icon={<XIcon size={18} />} label="Decline follow request" onClick={choose(f.decline)} />
              </>
            )}
            {f.iFollow && (
              <>
                <Item
                  icon={f.paused ? <PlayIcon size={18} /> : <PauseIcon size={18} />}
                  label={f.paused ? 'Resume following' : 'Pause following'}
                  onClick={choose(f.paused ? f.resume : f.pause)}
                />
                <Item icon={<XIcon size={18} />} label="Stop following" onClick={choose(f.stop)} />
              </>
            )}
            {!f.iFollow && f.pendingOut && <Item icon={<XIcon size={18} />} label="Cancel follow request" onClick={choose(f.cancel)} />}
            {!f.iFollow && !f.pendingOut && <Item icon={<FollowIcon size={18} />} label="Ask to follow" onClick={choose(f.ask)} />}
            {f.theyFollow && <Item icon={<BanIcon size={18} />} label="Stop them following me" onClick={choose(f.remove)} />}
          </>
        )
      )}
      {!f.blocked && onMessage && <Item icon={<ChatIcon size={18} />} label="Message" onClick={choose(() => onMessage(id))} />}
      <Item icon={<ArrowRightIcon size={18} />} label="Walk over" onClick={choose(walkOver)} />
    </div>
  )
}

function Item({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="rmenu-item" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  )
}
