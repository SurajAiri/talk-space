import { useEffect, useState } from 'react'
import type { ChatMessage } from '../../store/room.store'
import Avatar from '../Avatar'
import { LockIcon } from '../Icons'

const SHOW_MS = 5200
const LEAVE_MS = 260
const MAX_TILES = 3

/**
 * While the chat window is closed, each new message from someone else slides up from the bottom for
 * a few seconds and slips away again. Tap one to open the chat (a private one opens that conversation).
 *
 * Nothing is stored here: what is visible is worked out from when each message arrived, and a timer
 * only wakes the component at the next moment something should appear to change.
 */
export default function MessageTiles({
  messages,
  seenId,
  chatOpen,
  blocked,
  onOpen,
}: {
  messages: ChatMessage[]
  /** the last message the person has already had the chance to read (chat was open) */
  seenId: string | null
  chatOpen: boolean
  blocked: Record<string, true>
  onOpen: (fromId: string, dm: boolean) => void
}) {
  const [now, setNow] = useState(() => Date.now())

  const seenIndex = seenId ? messages.findIndex((m) => m.id === seenId) : -1
  const candidates = messages
    .slice(seenIndex + 1)
    .filter((m) => !m.self && !blocked[m.fromId] && now - m.ts < SHOW_MS + LEAVE_MS)
    .slice(-MAX_TILES)
  const tiles = chatOpen ? [] : candidates

  // the next moment a tile should start leaving or be gone (a plain number, so the effect only re-runs when it moves)
  const marks = tiles.flatMap((m) => [m.ts + SHOW_MS, m.ts + SHOW_MS + LEAVE_MS]).filter((t) => t > now)
  const nextMark = marks.length ? Math.min(...marks) : null
  useEffect(() => {
    if (nextMark === null) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, nextMark - Date.now()) + 15)
    return () => clearTimeout(timer)
  }, [nextMark])

  if (tiles.length === 0) return null
  return (
    <div className="tiles" aria-live="polite">
      {tiles.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`tile ${m.dm ? 'is-dm' : ''} ${now - m.ts >= SHOW_MS ? 'is-leaving' : ''}`}
          onClick={() => onOpen(m.fromId, m.dm)}
        >
          <Avatar name={m.fromName} size={32} />
          <span className="tile-main">
            <span className="tile-name">
              {m.fromName}
              {m.dm && (
                <span className="tile-private">
                  <LockIcon size={11} /> Private
                </span>
              )}
            </span>
            <span className="tile-text">{m.text}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
