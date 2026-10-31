import type { LinkState } from '../webrtc/types'
import { useAuthStore } from '../store/auth.store'
import { useRoomStore } from '../store/room.store'
import Avatar from './Avatar'
import PeerActions from './PeerActions'
import RemoteAudio from './RemoteAudio'

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

export default function ParticipantList() {
  const me = useAuthStore((s) => s.user)
  const peers = useRoomStore((s) => s.peers)
  const muted = useRoomStore((s) => s.muted)
  const mic = useRoomStore((s) => s.mic)
  // In a world, the ProximityMixer plays voices (with per-person volume); a plain <audio> here would double them.
  const hasWorld = useRoomStore((s) => s.world !== null)
  const blocked = useRoomStore((s) => s.blocked)
  const list = Object.values(peers)

  return (
    <ul className="people">
      <li className="person">
        <Avatar name={me?.name ?? 'You'} status="live" />
        <div className="person-name">
          {me?.name ?? 'You'} <span className="muted-inline">(you)</span>
        </div>
        <span className={mic === 'on' && !muted ? 'person-mic is-live' : 'person-mic'}>
          {mic === 'on' ? (muted ? 'Muted' : 'Live') : 'Listening'}
        </span>
      </li>
      {list.map((p) => {
        const isBlocked = Boolean(blocked[p.id])
        return (
          <li className="person" key={p.id}>
            <Avatar name={p.name} status={LINK_TONE[p.link]} />
            <div className="person-name">
              {p.name} <span className="muted-inline">@{p.username}</span>
              {p.link !== 'connected' && (
                <div className={`person-sub ${LINK_TONE[p.link] === 'bad' ? 'is-bad' : 'is-warn'}`}>{LINK_LABEL[p.link]}</div>
              )}
            </div>
            <span className={isBlocked ? 'person-mic is-bad' : !p.muted ? 'person-mic is-live' : 'person-mic'}>
              {isBlocked ? 'Blocked' : p.muted ? 'Muted' : 'Live'}
            </span>
            {!hasWorld && <RemoteAudio stream={isBlocked ? null : p.stream} />}
            <PeerActions peerId={p.id} name={p.name} />
          </li>
        )
      })}
    </ul>
  )
}
