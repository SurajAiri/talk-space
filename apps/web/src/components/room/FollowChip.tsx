import { useFollow } from '../../hooks/useFollow'
import { useRoomStore } from '../../store/room.store'
import type { WorldSession } from '../../world/WorldSession'
import { FollowIcon, PauseIcon, PlayIcon } from '../Icons'

/**
 * The follow state at a glance, under "who can hear you": who I am following (pause, resume or stop), who I have
 * asked and am waiting on, and who follows me. Shows nothing when none of that is going on.
 */
export default function FollowChip({ session, onPeople }: { session: WorldSession; onPeople: () => void }) {
  const f = useFollow(session)
  const peers = useRoomStore((s) => s.peers)
  const nameOf = (id: string) => peers[id]?.name.split(/\s+/)[0] || 'Someone'

  if (!f.following && !f.pending && f.followers.length === 0) return null

  return (
    <>
      {f.following && (
        <div className="fchip" role="status">
          <FollowIcon size={16} />
          <span className="fchip-text">
            {f.paused ? 'Paused: ' : 'Following '}
            {nameOf(f.following)}
          </span>
          <button
            type="button"
            className="fchip-btn"
            aria-label={f.paused ? `Resume following ${nameOf(f.following)}` : `Pause following ${nameOf(f.following)}`}
            onClick={() => (f.paused ? session.follow.resume() : session.follow.pause())}
          >
            {f.paused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
            {f.paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="fchip-btn" aria-label={`Stop following ${nameOf(f.following)}`} onClick={() => session.follow.stopFollowing()}>
            Stop
          </button>
        </div>
      )}
      {f.pending && (
        <div className="fchip" role="status">
          <FollowIcon size={16} />
          <span className="fchip-text">Waiting for {nameOf(f.pending)}…</span>
          <button type="button" className="fchip-btn" onClick={() => session.follow.cancelRequest()}>
            Cancel
          </button>
        </div>
      )}
      {f.followers.length > 0 && (
        <button type="button" className="fchip fchip-info" onClick={onPeople} title="Open the people list to manage who follows you">
          <FollowIcon size={16} />
          <span className="fchip-text">
            {f.followers.length === 1 ? `${nameOf(f.followers[0]!)} is` : `${f.followers.length} people are`} following you
          </span>
        </button>
      )}
    </>
  )
}
