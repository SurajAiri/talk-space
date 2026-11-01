import { useEffect, useRef, useState } from 'react'
import { labelFor, type RoomConfig, type RoomView } from '../../lib/rooms'
import CopyButton from '../CopyButton'
import { ChatIcon, ChevronDownIcon, GlobeIcon, MapIcon, MaximizeIcon, MinimizeIcon, PhoneOffIcon, UsersIcon } from '../Icons'
import { LogoMark } from '../Logo'

/** Everything that used to be a banner, a header and three panels, as one slim floating bar. */
export default function RoomTopBar({
  room,
  config,
  mapTitle,
  count,
  unread,
  chatOpen,
  peopleOpen,
  fullscreen,
  canFullscreen,
  onChat,
  onPeople,
  onFullscreen,
  onLeave,
}: {
  room: RoomView
  config: RoomConfig | null
  mapTitle?: string
  count: number
  unread: number
  chatOpen: boolean
  peopleOpen: boolean
  fullscreen: boolean
  canFullscreen: boolean
  onChat: () => void
  onPeople: () => void
  onFullscreen: () => void
  onLeave: () => void
}) {
  const [info, setInfo] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!info) return
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setInfo(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setInfo(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [info])

  return (
    <div className="rbar">
      <div className="rbar-left" ref={wrap}>
        <button type="button" className="rpill" aria-expanded={info} aria-haspopup="dialog" onClick={() => setInfo((v) => !v)}>
          <LogoMark size={24} />
          <span className="rpill-title">{room.title}</span>
          <span className="rpill-count">
            <UsersIcon size={14} />
            {count}/{room.maxMembers}
          </span>
          <ChevronDownIcon size={15} className={info ? 'flip' : ''} />
        </button>
        {info && (
          <div className="rinfo" role="dialog" aria-label="Room details">
            {room.shortDescription && <p className="rinfo-desc">{room.shortDescription}</p>}
            <div className="chips">
              <span className="chip">
                <GlobeIcon size={13} />
                {labelFor(config?.languages, room.language)}
              </span>
              <span className="chip chip-neutral">{labelFor(config?.purposes, room.purpose)}</span>
              {mapTitle && (
                <span className="chip chip-neutral">
                  <MapIcon size={13} />
                  {mapTitle}
                </span>
              )}
              {room.tags.map((t) => (
                <span key={t} className="chip chip-tag">
                  #{t}
                </span>
              ))}
            </div>
            <div className="rinfo-copy">
              <CopyButton value={room.id} label="Room ID" />
              {room.joinCode && <CopyButton value={room.joinCode} label="Join code" />}
            </div>
          </div>
        )}
      </div>

      <div className="rbar-right">
        <button type="button" className={`rbtn ${chatOpen ? 'is-on' : ''}`} aria-pressed={chatOpen} onClick={onChat}>
          <ChatIcon size={19} />
          <span className="rbtn-label">Chat</span>
          {unread > 0 && !chatOpen && <span className="rbadge">{unread > 9 ? '9+' : unread}</span>}
        </button>
        <button type="button" className={`rbtn ${peopleOpen ? 'is-on' : ''}`} aria-pressed={peopleOpen} onClick={onPeople}>
          <UsersIcon size={19} />
          <span className="rbtn-label">People</span>
        </button>
        {canFullscreen && (
          <button type="button" className="rbtn rbtn-icon" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={onFullscreen}>
            {fullscreen ? <MinimizeIcon size={19} /> : <MaximizeIcon size={19} />}
          </button>
        )}
        <button type="button" className="rbtn rbtn-leave" onClick={onLeave}>
          <PhoneOffIcon size={19} />
          <span className="rbtn-label">Leave</span>
        </button>
      </div>
    </div>
  )
}
