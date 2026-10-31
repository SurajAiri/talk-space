import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import AppHeader from '../components/AppHeader'
import ChatPanel from '../components/ChatPanel'
import CopyButton from '../components/CopyButton'
import { GlobeIcon, HeadphonesIcon, LockIcon, MapIcon, MicIcon, MicOffIcon, PhoneOffIcon, ShieldIcon, UsersIcon } from '../components/Icons'
import MapThumb from '../components/MapThumb'
import ParticipantList from '../components/ParticipantList'
import WorldView from '../components/WorldView'
import { useRoomConfig } from '../hooks/useRoomConfig'
import { labelFor, roomsApi, type RoomPreview } from '../lib/rooms'
import { useRoomStore } from '../store/room.store'

type PreviewState =
  | { state: 'loading' }
  | { state: 'ready'; data: RoomPreview }
  | { state: 'error'; message: string }

const ROOM_ID = /^[A-Z]{6}$/

const MIC_HINT: Partial<Record<string, string>> = {
  off: 'You’re listening only.',
  denied: 'Microphone is blocked. Allow it in your browser’s site settings, then try again.',
  unavailable: 'No working microphone was found on this device.',
  unsupported:
    'This browser only allows the microphone on secure pages. Open the site over HTTPS (or localhost).',
}

export default function RoomPage() {
  const params = useParams()
  const roomId = (params.roomId ?? '').toUpperCase()
  const status = useRoomStore((s) => s.status)

  // Leaving the page (back button, logo, ...) always leaves the room.
  useEffect(() => {
    return () => {
      void useRoomStore.getState().leave()
    }
  }, [])

  if (!ROOM_ID.test(roomId)) {
    return (
      <Shell>
        <Message title="That room link isn't valid" body="Room IDs are 6 letters." />
      </Shell>
    )
  }
  if (status === 'ended') return <Ended />
  if (status === 'joined' || status === 'reconnecting') return <InRoom />
  return <PreJoin roomId={roomId} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <AppHeader />
      <main className="center-screen center-below-header">{children}</main>
    </div>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="card message">
      <span className="message-icon">
        <UsersIcon size={24} />
      </span>
      <h1>{title}</h1>
      <p>{body}</p>
      <Link to="/home" className="btn btn-outline">
        Back to rooms
      </Link>
    </div>
  )
}

function Ended() {
  const reason = useRoomStore((s) => s.endedReason)
  return (
    <Shell>
      <Message title="You left the room" body={reason ?? 'This session has ended.'} />
    </Shell>
  )
}

function PreJoin({ roomId }: { roomId: string }) {
  const location = useLocation()
  const config = useRoomConfig()
  const status = useRoomStore((s) => s.status)
  const join = useRoomStore((s) => s.join)

  const initialCode = (location.state as { joinCode?: string } | null)?.joinCode ?? ''
  const [code, setCode] = useState(initialCode)
  const [preview, setPreview] = useState<PreviewState>({ state: 'loading' })
  const [error, setError] = useState<string | null>(null)
  const [hideIp, setHideIp] = useState(false)
  const joining = status === 'joining'

  useEffect(() => {
    if (status !== 'idle') return
    let cancelled = false
    roomsApi
      .preview(roomId)
      .then((data) => !cancelled && setPreview({ state: 'ready', data }))
      .catch((err) => {
        if (!cancelled) {
          setPreview({
            state: 'error',
            message: err instanceof Error ? err.message : 'Could not load the room',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [roomId, status])

  async function onJoin(withMic: boolean) {
    setError(null)
    const res = await join(roomId, { joinCode: code || undefined, withMic, hideIp })
    if (!res.ok && res.code !== 'CANCELLED') setError(res.message)
  }

  if (preview.state === 'error') {
    return (
      <Shell>
        <Message title="Can't open this room" body={preview.message} />
      </Shell>
    )
  }
  if (preview.state === 'loading') {
    return (
      <Shell>
        <div className="card message" role="status">
          <h1>Loading room…</h1>
        </div>
      </Shell>
    )
  }

  const room = preview.data
  const isPrivate = room.requiresJoinCode
  // private rooms don't say how many are inside; the server refuses us if it is full
  const full = !isPrivate && room.participantCount >= room.maxMembers
  const codeLength = config?.joinCodeLength ?? 6
  const needsCode = isPrivate && code.length !== codeLength && !initialCode

  return (
    <Shell>
      <div className="card prejoin">
        <div className={isPrivate ? 'prejoin-banner is-private' : 'prejoin-banner'}>
          {isPrivate ? <LockIcon size={34} /> : <MapThumb mapKey={room.map} />}
        </div>
        <div className="prejoin-body">
          <div className="stack" style={{ gap: 6 }}>
            <h1>{isPrivate ? 'Private room' : room.title}</h1>
            {!isPrivate && room.shortDescription && <p className="muted-left">{room.shortDescription}</p>}
          </div>

          {!isPrivate && (
            <div className="chips">
              <span className="chip">
                <GlobeIcon size={13} />
                {labelFor(config?.languages, room.language)}
              </span>
              <span className="chip chip-neutral">{labelFor(config?.purposes, room.purpose)}</span>
              {room.tags.map((t) => (
                <span key={t} className="chip chip-tag">
                  #{t}
                </span>
              ))}
            </div>
          )}

          <p className="facts">
            <span>
              Room <code>{room.id}</code>
            </span>
            <span>
              <UsersIcon size={15} />
              {isPrivate ? `Up to ${room.maxMembers} people` : `${room.participantCount} of ${room.maxMembers} here`}
            </span>
          </p>

          {isPrivate && (
            <label className="field">
              Join code
              <input
                placeholder={`${codeLength} digits`}
                value={code}
                maxLength={codeLength}
                inputMode="numeric"
                autoComplete="off"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </label>
          )}

          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}

          {config?.forceRelay ? (
            <div className="option-row is-static">
              <ShieldIcon size={18} />
              <div>
                <strong>Your IP address is hidden</strong>
                <span>This server routes all connections through a relay, so other participants never see it.</span>
              </div>
            </div>
          ) : (
            <label className="option-row">
              <input
                type="checkbox"
                checked={hideIp}
                disabled={!config?.relayAvailable}
                onChange={(e) => setHideIp(e.target.checked)}
              />
              <div>
                <strong>Hide my IP address</strong>
                <span>
                  {config?.relayAvailable
                    ? hideIp
                      ? 'You connect through a relay: a little more delay, and nobody sees your IP.'
                      : 'Connect through a relay for a little more delay. Otherwise other participants can see your IP, because voice and chat go directly between browsers.'
                    : 'Unavailable: this server has no relay. Other participants can see your IP, because voice and chat go directly between browsers.'}
                </span>
              </div>
            </label>
          )}

          <div className="stack">
            <button type="button" className="btn btn-lg" disabled={joining || full || needsCode} onClick={() => onJoin(true)}>
              <MicIcon size={18} />
              {joining ? 'Joining…' : full ? 'Room is full' : 'Join with microphone'}
            </button>
            <button type="button" className="btn btn-outline btn-lg" disabled={joining || full || needsCode} onClick={() => onJoin(false)}>
              <HeadphonesIcon size={18} />
              Join listen-only
            </button>
          </div>
          <p className="hint center">The server only helps you find each other.</p>
        </div>
      </div>
    </Shell>
  )
}

function InRoom() {
  const navigate = useNavigate()
  const config = useRoomConfig()
  const status = useRoomStore((s) => s.status)
  const room = useRoomStore((s) => s.room)
  const peerCount = useRoomStore((s) => Object.keys(s.peers).length)
  const mic = useRoomStore((s) => s.mic)
  const muted = useRoomStore((s) => s.muted)
  const world = useRoomStore((s) => s.world)
  const toggleMute = useRoomStore((s) => s.toggleMute)
  const enableMic = useRoomStore((s) => s.enableMic)
  const leave = useRoomStore((s) => s.leave)

  if (!room) return null

  async function onLeave() {
    await leave()
    navigate('/home', { replace: true })
  }

  return (
    <div className="app app-room">
      <AppHeader />
      <main className={world ? 'room room-wide' : 'room'}>
        <header className="room-head">
          <div>
            <h1>{room.title}</h1>
            <div className="chips">
              <span className="chip">
                <GlobeIcon size={13} />
                {labelFor(config?.languages, room.language)}
              </span>
              <span className="chip chip-neutral">{labelFor(config?.purposes, room.purpose)}</span>
              {world && (
                <span className="chip chip-neutral">
                  <MapIcon size={13} />
                  {world.map.title}
                </span>
              )}
              {room.tags.map((t) => (
                <span key={t} className="chip chip-tag">
                  #{t}
                </span>
              ))}
            </div>
          </div>
          <div className="room-head-actions">
            <CopyButton value={room.id} label="Room ID" />
            {room.joinCode && <CopyButton value={room.joinCode} label="Join code" />}
          </div>
        </header>

        {status === 'reconnecting' && (
          <p className="notice notice-warn" role="status">
            Connection to the server was lost. Reconnecting…
          </p>
        )}

        <div className={world ? 'room-body room-body-world' : 'room-body'}>
          {world && (
            <section className="panel panel-world" aria-label="World">
              <WorldView session={world} />
            </section>
          )}
          <section className="panel panel-people" aria-label="People">
            <div className="panel-head">
              <h2>People</h2>
              <span className="count-pill">
                {peerCount + 1} of {room.maxMembers}
              </span>
            </div>
            <ParticipantList />
          </section>
          <section className="panel panel-chat" aria-label="Chat">
            <div className="panel-head">
              <h2>Chat</h2>
            </div>
            <ChatPanel maxLength={config?.chatMessageMax ?? 2000} />
          </section>
        </div>

        <footer className="dock">
          {mic === 'on' ? (
            <button
              type="button"
              className={muted ? 'btn btn-outline dock-btn is-muted' : 'btn btn-outline dock-btn is-live'}
              onClick={toggleMute}
              aria-pressed={!muted}
            >
              {muted ? <MicOffIcon size={19} /> : <MicIcon size={19} />}
              {muted ? 'Unmute microphone' : 'Mute microphone'}
            </button>
          ) : (
            <button type="button" className="btn dock-btn" onClick={() => void enableMic()}>
              <MicIcon size={19} />
              Turn on microphone
            </button>
          )}
          <span className="dock-status" role="status">
            {MIC_HINT[mic] ?? (muted ? 'You’re muted.' : 'Others can hear you.')}
          </span>
          <span className="dock-sep" aria-hidden="true" />
          <button type="button" className="btn btn-danger dock-btn" onClick={onLeave}>
            <PhoneOffIcon size={19} />
            Leave
          </button>
        </footer>
      </main>
    </div>
  )
}
