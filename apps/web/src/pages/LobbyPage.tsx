import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import AppHeader from '../components/AppHeader'
import CreateRoomDialog from '../components/CreateRoomDialog'
import JoinPrivateForm from '../components/JoinPrivateForm'
import { LockIcon, PlusIcon, SearchIcon, VolumeIcon } from '../components/Icons'
import { LogoMark } from '../components/Logo'
import RoomCard from '../components/RoomCard'
import { useDebounced } from '../hooks/useDebounced'
import { useRoomConfig } from '../hooks/useRoomConfig'
import { roomsApi, type RoomFilters, type RoomView } from '../lib/rooms'

const POLL_MS = 5000

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

  // Rooms are ephemeral, so keep the list fresh while the lobby is open.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const list = await roomsApi.list(applied)
        if (cancelled) return
        setRooms(list)
        setLoadError(false)
      } catch {
        if (!cancelled) setLoadError(true)
      }
    }
    void load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [applied])

  const set =
    (key: 'q' | 'language' | 'purpose' | 'tags') =>
    (e: { target: { value: string } }) =>
      setFilters((f) => ({ ...f, [key]: e.target.value }))

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
          <button type="button" className="btn btn-lg" disabled={!config} onClick={() => setCreating(true)}>
            <PlusIcon size={18} />
            New room
          </button>
        </div>

        <div className="lobby">
          <section className="lobby-main" aria-labelledby="public-rooms">
            <div className="toolbar" role="search">
              <label className="search">
                <SearchIcon size={17} />
                <input
                  type="search"
                  aria-label="Search rooms"
                  placeholder="Search by title, description or tag"
                  value={filters.q}
                  onChange={set('q')}
                />
              </label>
              <select aria-label="Language" value={filters.language} onChange={set('language')}>
                <option value="">Any language</option>
                {config?.languages.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <select aria-label="Purpose" value={filters.purpose} onChange={set('purpose')}>
                <option value="">Any purpose</option>
                {config?.purposes.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                className="tags-input"
                aria-label="Filter by tags"
                placeholder="Tags: rust, go"
                value={filters.tags}
                onChange={set('tags')}
              />
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={filters.hasSpace}
                  onChange={(e) => setFilters((f) => ({ ...f, hasSpace: e.target.checked }))}
                />
                Has space
              </label>
            </div>

            {loadError && (
              <p className="notice notice-error" role="alert">
                Couldn&apos;t load rooms. Retrying…
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
                  <span>Chat reaches the whole room.</span>
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
