import type { LinkState } from '../webrtc/types'
import { usePeerFollow } from '../hooks/useFollow'
import { useAuthStore } from '../store/auth.store'
import { useRoomStore } from '../store/room.store'
import Avatar from './Avatar'
import PeerActions from './PeerActions'

const LINK_LABEL: Record<LinkState, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  unstable: 'Unstable connection',
  failed: "Can't connect",
  closed: 'Disconnected',
}
const LINK_TONE: Record<LinkState, 'live' | 'warn' | 'bad' | 'idle'> = {
  connecting: 'warn',
  connected: 'live',
  unstable: 'warn',
  failed: 'bad',
  closed: 'bad',
}

/** What follows between me and this person, in the row: who follows whom, and the buttons for a request waiting on me. */
function FollowLine({ peerId }: { peerId: string }) {
  const f = usePeerFollow(peerId)
  if (f.blocked) return null
  return (
    <>
      {(f.iFollow || f.pendingOut || f.theyFollow) && (
        <div className="person-sub">
          {f.iFollow && <span className="is-follow">{f.paused ? 'You paused following' : 'You are following'}</span>}
          {f.pendingOut && <span className="is-follow">Follow request sent</span>}
          {f.theyFollow && (
            <>
              <span className="is-follow">Following you</span>
              <button type="button" className="link-btn" onClick={f.remove}>
                Remove
              </button>
            </>
          )}
        </div>
      )}
      {f.theyAsked && (
        <div className="person-sub follow-ask" role="group" aria-label="Follow request">
          <span className="is-follow">Wants to follow you</span>
          <button type="button" className="btn btn-small" onClick={f.accept}>
            Accept
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={f.decline}>
            Decline
          </button>
        </div>
      )}
    </>
  )
}

/** Everyone in the room, with the per-person actions. (Voice playback lives in RemoteAudioHost.) */
export default function ParticipantList({ onMessage }: { onMessage: (peerId: string) => void }) {
  const me = useAuthStore((s) => s.user)
  const peers = useRoomStore((s) => s.peers)
  const mic = useRoomStore((s) => s.mic)
  const muted = useRoomStore((s) => s.muted)
  const blocked = useRoomStore((s) => s.blocked)
  const list = Object.values(peers)

  return (
    <ul className="people">
      <li className="person">
        <Avatar name={me?.name ?? 'You'} status="live" />
        <div className="person-name">
          {me?.name ?? 'You'} <span className="muted-inline">(you)</span>
          <div className="person-sub">
            <span className={mic === 'on' && !muted ? 'person-mic is-live' : 'person-mic'}>
              {mic === 'on' ? (muted ? 'Muted' : 'Live') : 'Listening'}
            </span>
          </div>
        </div>
      </li>
      {list.length === 0 && <li className="people-empty">Nobody else is here yet. Share the room ID to invite people.</li>}
      {list.map((p) => {
        const isBlocked = Boolean(blocked[p.id])
        return (
          <li className="person" key={p.id}>
            <Avatar name={p.name} status={LINK_TONE[p.link]} />
            <div className="person-name">
              {p.name}
              <div className="person-sub">
                <span>@{p.username}</span>
                <span className={isBlocked ? 'person-mic is-bad' : !p.muted ? 'person-mic is-live' : 'person-mic'}>
                  {isBlocked ? 'Blocked' : p.muted ? 'Muted' : 'Live'}
                </span>
                {p.link !== 'connected' && <span className={LINK_TONE[p.link] === 'bad' ? 'is-bad' : 'is-warn'}>{LINK_LABEL[p.link]}</span>}
              </div>
              {p.link !== 'connected' && p.problem && (
                <div className="person-sub">
                  <span className="is-bad">{p.problem}</span>
                </div>
              )}
              <FollowLine peerId={p.id} />
            </div>
            <PeerActions peerId={p.id} name={p.name} onMessage={() => onMessage(p.id)} />
          </li>
        )
      })}
    </ul>
  )
}
