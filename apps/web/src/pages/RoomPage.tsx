import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import AppHeader from '../components/AppHeader'
import ChatPanel from '../components/ChatPanel'
import CopyButton from '../components/CopyButton'
import ParticipantList from '../components/ParticipantList'
import { useRoomConfig } from '../hooks/useRoomConfig'
import { labelFor, roomsApi, type RoomPreview } from '../lib/rooms'
import { useRoomStore } from '../store/room.store'

type PreviewState =
  | { state: 'loading' }
  | { state: 'ready'; data: RoomPreview }
  | { state: 'error'; message: string }

const ROOM_ID = /^[A-Z]{6}$/

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
    <div className="card">
      <h1>{title}</h1>
      <p className="muted-left">{body}</p>
      <Link to="/home" className="btn btn-outline center">
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
    const res = await join(roomId, { joinCode: code || undefined, withMic })
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
        <div className="card">Loading room…</div>
      </Shell>
    )
  }

  const room = preview.data
  const isPrivate = room.requiresJoinCode
  const full = room.participantCount >= room.maxMembers
  const codeLength = config?.joinCodeLength ?? 6
  const needsCode = isPrivate && code.length !== codeLength && !initialCode

  return (
    <Shell>
      <div className="card card-wide">
        <div>
          <h1>{isPrivate ? 'Private room' : room.title}</h1>
          {!isPrivate && room.shortDescription && (
            <p className="muted-left">{room.shortDescription}</p>
          )}
        </div>

        {!isPrivate && (
          <div className="chips">
            <span className="chip">{labelFor(config?.languages, room.language)}</span>
            <span className="chip">{labelFor(config?.purposes, room.purpose)}</span>
            {room.tags.map((t) => (
              <span key={t} className="chip chip-tag">
                #{t}
              </span>
            ))}
          </div>
        )}

        <p className="muted-left">
          Room <strong>{room.id}</strong> · {room.participantCount}/{room.maxMembers} people
        </p>

        {isPrivate && (
          <input
            aria-label="Join code"
            placeholder={`Join code (${codeLength} digits)`}
            value={code}
            maxLength={codeLength}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        )}

        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}

        <div className="stack">
          <button
            type="button"
            className="btn"
            disabled={joining || full || needsCode}
            onClick={() => onJoin(true)}
          >
            {joining ? 'Joining…' : full ? 'Room is full' : 'Join with microphone'}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            disabled={joining || full || needsCode}
            onClick={() => onJoin(false)}
          >
            Join listen-only
          </button>
        </div>
        <p className="hint">
          Voice and chat go directly between participants' browsers. The server only helps you find
          each other.
        </p>
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
      <main className="room">
        <header className="room-head">
          <div>
            <h1>{room.title}</h1>
            <div className="chips">
              <span className="chip">{labelFor(config?.languages, room.language)}</span>
              <span className="chip">{labelFor(config?.purposes, room.purpose)}</span>
              {room.tags.map((t) => (
                <span key={t} className="chip chip-tag">
                  #{t}
                </span>
              ))}
              <span className="chip">
                {peerCount + 1}/{room.maxMembers} people
              </span>
            </div>
          </div>
          <div className="room-head-actions">
            <CopyButton value={room.id} label="Room ID" />
            {room.joinCode && <CopyButton value={room.joinCode} label="Join code" />}
            <button type="button" className="btn btn-danger" onClick={onLeave}>
              Leave room
            </button>
          </div>
        </header>

        {status === 'reconnecting' && (
          <p className="notice" role="status">
            Connection to the server was lost. Reconnecting…
          </p>
        )}

        <div className="room-body">
          <section className="panel" aria-label="People">
            <h2>People</h2>
            <ParticipantList />
          </section>
          <section className="panel panel-chat" aria-label="Chat">
            <h2>Chat</h2>
            <ChatPanel maxLength={config?.chatMessageMax ?? 2000} />
          </section>
        </div>

        <footer className="controls">
          {mic === 'on' ? (
            <button
              type="button"
              className={muted ? 'btn btn-outline' : 'btn'}
              onClick={toggleMute}
              aria-pressed={!muted}
            >
              {muted ? 'Unmute microphone' : 'Mute microphone'}
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => void enableMic()}>
              Turn on microphone
            </button>
          )}
          <span className="hint">
            {mic === 'denied'
              ? 'Microphone is blocked. Allow it in your browser’s site settings, then try again.'
              : mic === 'off'
                ? 'You’re listening only.'
                : muted
                  ? 'You’re muted.'
                  : 'Others can hear you.'}
          </span>
        </footer>
      </main>
    </div>
  )
}
