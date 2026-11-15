import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import AppHeader from '../components/AppHeader'
import CreateRoomDialog from '../components/CreateRoomDialog'
import JoinPrivateForm from '../components/JoinPrivateForm'
import { SelectField, Switch, TextField } from '../components/form/fields'
import { GlobeIcon, HashIcon, LockIcon, PlusIcon, RotateIcon, SearchIcon, VolumeIcon } from '../components/Icons'
import { LogoMark } from '../components/Logo'
import RoomCard from '../components/RoomCard'
import { useDebounced } from '../hooks/useDebounced'
import { useRoomConfig } from '../hooks/useRoomConfig'
import { roomsApi, type RoomFilters, type RoomView } from '../lib/rooms'

/**
 * Rooms are ephemeral, so the list goes stale, but every refresh costs the server a few Redis reads PER ROOM
 * per open lobby. So: a slow background refresh, only while this tab is actually visible, one more when the
 * person comes back to the tab, and a button for "I want it now".
 */
const POLL_MS = 30_000
/** coming back to the tab refreshes only if the list is at least this old */
const STALE_MS = 10_000

export default function LobbyPage() {
  const navigate = useNavigate()
  const config = useRoomConfig()
  const [creating, setCreating] = useState(false)
  const [filters, setFilters] = useState<RoomFilters>({
    q: '',
    language: '',
    purpose: '',
    tags: '',
    hasSpace: false,
  })
  const applied = useDebounced(filters, 300)
  const [rooms, setRooms] = useState<RoomView[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve())

  useEffect(() => {
    let cancelled = false
    let inFlight: Promise<void> | null = null
    let loadedAt = 0

    // One request at a time: a button press during a background refresh just joins it.
    const load = (): Promise<void> => {
      if (inFlight) return inFlight
      setRefreshing(true)
      inFlight = (async () => {
        try {
          const list = await roomsApi.list(applied)
          if (cancelled) return
          setRooms(list)
          setLoadError(false)
          loadedAt = Date.now()
        } catch {
          if (!cancelled) setLoadError(true)
        } finally {
          inFlight = null
          if (!cancelled) setRefreshing(false)
        }
      })()
      return inFlight
    }
    refreshRef.current = load
    void load()

    const id = setInterval(() => {
      if (!document.hidden) void load()
    }, POLL_MS)
    const onVisible = () => {
      if (!document.hidden && Date.now() - loadedAt > STALE_MS) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [applied])

  const filtering = Boolean(
    filters.q || filters.language || filters.purpose || filters.tags || filters.hasSpace,
  )

  const people = rooms?.reduce((n, r) => n + r.participantCount, 0) ?? 0

  return (
    <div className="app">
      <AppHeader />
      <main className="page">
        <div className="page-head">
          <div>
            <h1 id="public-rooms">Rooms</h1>
            <p className="page-sub">
              {rooms === null
                ? 'Looking for open rooms…'
                : rooms.length === 0
                  ? 'Nothing open right now.'
                  : `${people} ${people === 1 ? 'person is' : 'people are'} talking in ${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}.`}
            </p>
          </div>
          <div className="page-actions">
            <button
              type="button"
              className={`btn btn-outline btn-lg${refreshing ? ' is-spinning' : ''}`}
              disabled={refreshing}
              aria-busy={refreshing}
              onClick={() => void refreshRef.current()}
            >
              <RotateIcon size={18} />
              Refresh
            </button>
            <button type="button" className="btn btn-lg" disabled={!config} onClick={() => setCreating(true)}>
              <PlusIcon size={18} />
              New room
            </button>
          </div>
        </div>

        <div className="lobby">
          <section className="lobby-main" aria-labelledby="public-rooms">
            <div className="toolbar" role="search">
              <TextField
                className="search"
                label="Search rooms"
                hideLabel
                type="search"
                icon={<SearchIcon size={17} />}
                clearable
                placeholder="Search by title, description or tag"
                value={filters.q}
                onValueChange={(v) => setFilters((f) => ({ ...f, q: v }))}
              />
              <SelectField
                label="Language"
                hideLabel
                icon={<GlobeIcon size={17} />}
                value={filters.language}
                onValueChange={(v) => setFilters((f) => ({ ...f, language: v }))}
              >
                <option value="">Any language</option>
                {config?.languages.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Purpose"
                hideLabel
                value={filters.purpose}
                onValueChange={(v) => setFilters((f) => ({ ...f, purpose: v }))}
              >
                <option value="">Any purpose</option>
                {config?.purposes.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </SelectField>
              <TextField
                className="tags-input"
                label="Filter by tags"
                hideLabel
                icon={<HashIcon size={17} />}
                placeholder="Tags: rust, go"
                autoCapitalize="none"
                value={filters.tags}
                onValueChange={(v) => setFilters((f) => ({ ...f, tags: v }))}
              />
              <Switch checked={filters.hasSpace} onChange={(v) => setFilters((f) => ({ ...f, hasSpace: v }))}>
                Has space
              </Switch>
            </div>

            {loadError && (
              <p className="notice notice-error" role="alert">
                Couldn&apos;t load rooms. Check your connection, then press Refresh.
              </p>
            )}
            {rooms === null && !loadError && (
              <div className="room-list" aria-busy="true" aria-label="Loading rooms">
                {[0, 1, 2].map((i) => (
                  <div className="skeleton-row" key={i}>
                    <div className="skeleton" style={{ aspectRatio: '44 / 32' }} />
                    <div className="stack" style={{ gap: 10 }}>
                      <div className="skeleton" style={{ height: 18, width: '45%' }} />
                      <div className="skeleton" style={{ height: 14, width: '80%' }} />
                      <div className="skeleton" style={{ height: 14, width: '30%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {rooms?.length === 0 && (
              <div className="empty">
                <LogoMark size={44} />
                <h2>{filtering ? 'No rooms match those filters' : 'No one is talking right now'}</h2>
                <p>
                  {filtering
                    ? 'Try a different language or clear the search.'
                    : 'Rooms close when everyone leaves. Start one and others can walk in.'}
                </p>
                {!filtering && config && (
                  <button type="button" className="btn" onClick={() => setCreating(true)}>
                    <PlusIcon size={18} />
                    Start a room
                  </button>
                )}
              </div>
            )}
            {rooms && rooms.length > 0 && (
              <ul className="room-list">
                {rooms.map((r) => (
                  <RoomCard key={r.id} room={r} config={config} onJoin={(x) => navigate(`/room/${x.id}`)} />
                ))}
              </ul>
            )}
          </section>

          <aside className="lobby-side" aria-label="More ways to join">
            <div className="side-card">
              <h2>
                <LockIcon size={17} />
                Join a private room
              </h2>
              <JoinPrivateForm config={config} />
            </div>
            <div className="side-card side-note">
              <h2>
                <VolumeIcon size={17} />
                How hearing works
              </h2>
              <ul>
                <li>
                  <span aria-hidden="true">●</span>
                  <span>In the open, you hear people near you. They fade out as they walk away.</span>
                </li>
                <li>
                  <span aria-hidden="true">●</span>
                  <span>Inside a marked area, everyone hears each other.</span>
                </li>
                <li>
                  <span aria-hidden="true">●</span>
                  <span>Chat goes to everyone, or privately to just one person.</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      {creating && config && <CreateRoomDialog config={config} onClose={() => setCreating(false)} />}
    </div>
  )
}
