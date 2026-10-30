import type { LinkState } from '../webrtc/types'
import { useAuthStore } from '../store/auth.store'
import { useRoomStore } from '../store/room.store'
import PeerActions from './PeerActions'
import RemoteAudio from './RemoteAudio'

const LINK_LABEL: Record<LinkState, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  unstable: 'Unstable connection',
  failed: "Can't connect",
  closed: 'Disconnected',
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
        <span className="dot dot-ok" aria-hidden="true" />
        <div className="person-name">
          {me?.name ?? 'You'} <span className="muted-inline">(you)</span>
        </div>
        <span className="person-mic">{mic === 'on' ? (muted ? 'Muted' : 'Live') : 'Listening'}</span>
      </li>
      {list.map((p) => (
        <li className="person" key={p.id}>
          <span className={`dot dot-${p.link}`} aria-hidden="true" />
          <div className="person-name">
            {p.name} <span className="muted-inline">@{p.username}</span>
            <div className="person-sub">{LINK_LABEL[p.link]}</div>
          </div>
          <span className="person-mic">{blocked[p.id] ? 'Blocked' : p.muted ? 'Muted' : 'Live'}</span>
          {!hasWorld && <RemoteAudio stream={blocked[p.id] ? null : p.stream} />}
          <PeerActions peerId={p.id} name={p.name} />
        </li>
      ))}
    </ul>
  )
}
