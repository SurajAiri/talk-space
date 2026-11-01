import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import AppHeader from '../components/AppHeader'
import { CodeInput, Switch } from '../components/form/fields'
import { GlobeIcon, HeadphonesIcon, LockIcon, MicIcon, ShieldIcon, UsersIcon } from '../components/Icons'
import MapThumb from '../components/MapThumb'
import ParticipantList from '../components/ParticipantList'
import RemoteAudio from '../components/RemoteAudio'
import ChatWindow from '../components/room/ChatWindow'
import FloatPanel from '../components/room/FloatPanel'
import HearingChip from '../components/room/HearingChip'
import Joystick from '../components/room/Joystick'
import MessageTiles from '../components/room/MessageTiles'
import MicDock from '../components/room/MicDock'
import RoomTopBar from '../components/room/RoomTopBar'
import RotatePrompt from '../components/room/RotatePrompt'
import WorldView from '../components/WorldView'
import { useRoomConfig } from '../hooks/useRoomConfig'
import { useCoarsePointer, usePortrait, useShortScreen } from '../hooks/useMedia'
import { enterImmersive, exitImmersive, fullscreenSupported, useIsFullscreen } from '../lib/fullscreen'
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
      void exitImmersive()
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
  const coarse = useCoarsePointer()

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
    // phones: full screen + landscape need this click, so ask before the (slow) join starts
    if (coarse) void enterImmersive(true)
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
            <CodeInput
              label="Join code"
              length={codeLength}
              mode="digits"
              value={code}
              onValueChange={setCode}
              hint={`${codeLength} digits, from whoever invited you`}
              autoFocus={!initialCode}
            />
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
            <Switch
              checked={hideIp}
              disabled={!config?.relayAvailable}
              onChange={setHideIp}
              description={
                config?.relayAvailable
                  ? hideIp
                    ? 'You connect through a relay: a little more delay, and nobody sees your IP.'
                    : 'Otherwise other participants can see your IP, because voice and chat go directly between browsers.'
                  : 'Unavailable: this server has no relay. Other participants can see your IP, because voice and chat go directly between browsers.'
              }
            >
              Hide my IP address
            </Switch>
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
  const world = useRoomStore((s) => s.world)
  const messages = useRoomStore((s) => s.messages)
  const blocked = useRoomStore((s) => s.blocked)
  const leave = useRoomStore((s) => s.leave)

  const coarse = useCoarsePointer()
  const portrait = usePortrait()
  const short = useShortScreen()
  const fullscreen = useIsFullscreen()

  // rooms without a map have nothing else to look at, so their panels start open
  const [chatOpen, setChatOpen] = useState(() => !useRoomStore.getState().world)
  const [peopleOpen, setPeopleOpen] = useState(() => !useRoomStore.getState().world)
  const [chatTo, setChatTo] = useState('all')
  // "read" = the chat was open when it arrived. Tracked by message id, so it survives the log being trimmed.
  const latestId = messages.at(-1)?.id ?? null
  const [seenId, setSeenId] = useState<string | null>(() => useRoomStore.getState().messages.at(-1)?.id ?? null)
  if (chatOpen && seenId !== latestId) setSeenId(latestId)
  const seenIndex = seenId ? messages.findIndex((m) => m.id === seenId) : -1
  const unread = messages.slice(seenIndex + 1).filter((m) => !m.self && !blocked[m.fromId]).length

  // on a short screen two panels would cover the whole map: only one at a time
  const openChat = useCallback(
    (to?: string) => {
      if (to) setChatTo(to)
      setChatOpen(true)
      if (short) setPeopleOpen(false)
    },
    [short],
  )
  const openPeople = useCallback(() => {
    setPeopleOpen(true)
    if (short) setChatOpen(false)
  }, [short])

  if (!room) return null

  async function onLeave() {
    await leave()
    void exitImmersive()
    navigate('/home', { replace: true })
  }

  async function toggleFullscreen() {
    if (fullscreen) await exitImmersive()
    else await enterImmersive(coarse)
  }

  const map = world?.map

  return (
    <div className="room-screen">
      {world ? (
        <div className="room-world">
          <WorldView session={world} />
        </div>
      ) : (
        <div className="room-backdrop" />
      )}
      {/* with a map, voices are played by the proximity mixer (so they fade with distance); without, plainly */}
      {!world && <RemoteAudioHost />}

      <RoomTopBar
        room={room}
        config={config}
        mapTitle={map?.title}
        count={peerCount + 1}
        unread={unread}
        chatOpen={chatOpen}
        peopleOpen={peopleOpen}
        fullscreen={fullscreen}
        canFullscreen={fullscreenSupported()}
        onChat={() => (chatOpen ? setChatOpen(false) : openChat())}
        onPeople={() => (peopleOpen ? setPeopleOpen(false) : openPeople())}
        onFullscreen={() => void toggleFullscreen()}
        onLeave={() => void onLeave()}
      />

      {status === 'reconnecting' && (
        <p className="notice notice-warn rtoast" role="status">
          Connection to the server was lost. Reconnecting…
        </p>
      )}

      {world && (
        <div className="room-bl">
          <HearingChip session={world} onClick={openPeople} />
        </div>
      )}
      {world && coarse && <Joystick session={world} />}
      <MoveHint coarse={coarse} />

      <MessageTiles messages={messages} seenId={seenId} chatOpen={chatOpen} blocked={blocked} onOpen={(from, dm) => openChat(dm ? from : undefined)} />
      <MicDock />

      {chatOpen && (
        <FloatPanel id="chat" title="Chat" width={short ? 300 : 360} height={540} anchor="right" onClose={() => setChatOpen(false)}>
          <ChatWindow to={chatTo} onToChange={setChatTo} maxLength={config?.chatMessageMax ?? 2000} autoFocus={!coarse} />
        </FloatPanel>
      )}
      {peopleOpen && (
        <FloatPanel
          id="people"
          title="People"
          width={340}
          height={460}
          fit
          anchor="left"
          onClose={() => setPeopleOpen(false)}
          headerExtra={
            <span className="count-pill">
              {peerCount + 1} of {room.maxMembers}
            </span>
          }
        >
          <ParticipantList
            onMessage={(id) => {
              openChat(id)
            }}
          />
        </FloatPanel>
      )}

      {coarse && portrait && <RotatePrompt onLeave={() => void onLeave()} />}
    </div>
  )
}

/** Plays everyone's voice when the room has no map (with a map, ProximityMixer does it). */
function RemoteAudioHost() {
  const peers = useRoomStore((s) => s.peers)
  const blocked = useRoomStore((s) => s.blocked)
  return (
    <>
      {Object.values(peers).map((p) => (
        <RemoteAudio key={p.id} stream={blocked[p.id] ? null : p.stream} />
      ))}
    </>
  )
}

const HINT_KEY = 'ts.hint.move'

/** A one-time nudge about how to walk, gone after a few seconds (and never shown again on this browser). */
function MoveHint({ coarse }: { coarse: boolean }) {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) !== '1'
    } catch {
      return true
    }
  })
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => {
      setShow(false)
      try {
        localStorage.setItem(HINT_KEY, '1')
      } catch {
        /* fine */
      }
    }, 8000)
    return () => clearTimeout(t)
  }, [show])
  if (!show) return null
  return (
    <p className="movehint" role="status">
      {coarse ? (
        <>Drag the joystick or tap the map to walk. Pinch to zoom.</>
      ) : (
        <>
          Walk with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or click the map. Scroll to zoom.
        </>
      )}
    </p>
  )
}
