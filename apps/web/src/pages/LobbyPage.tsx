import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import AppHeader from '../components/AppHeader'
import CreateRoomDialog from '../components/CreateRoomDialog'
import JoinPrivateForm from '../components/JoinPrivateForm'
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

  return (
    <div className="app">
      <AppHeader />
      <main className="page lobby">
        <section className="lobby-main" aria-labelledby="public-rooms">
          <h1 id="public-rooms">Public rooms</h1>

          <div className="filters">
            <input
              type="search"
              aria-label="Search rooms"
              placeholder="Search title, description or tag"
              value={filters.q}
              onChange={set('q')}
            />
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
              aria-label="Filter by tags"
              placeholder="Tags: rust, go"
              value={filters.tags}
              onChange={set('tags')}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={filters.hasSpace}
                onChange={(e) => setFilters((f) => ({ ...f, hasSpace: e.target.checked }))}
              />
              Has space
            </label>
          </div>

          {loadError && <p className="notice notice-error">Couldn't load rooms. Retrying…</p>}
          {rooms === null && !loadError && <p className="muted-left">Loading rooms…</p>}
          {rooms?.length === 0 && (
            <div className="empty">
              <p>
                {filtering
                  ? 'No rooms match those filters.'
                  : 'No one is talking right now. Start the first room.'}
              </p>
              {!filtering && config && (
                <button type="button" className="btn" onClick={() => setCreating(true)}>
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

        <aside className="lobby-side">
          <div className="card">
            <h2>Start a room</h2>
            <p className="muted-left">Pick a topic and language. Share it publicly or keep it private.</p>
            <button type="button" className="btn" disabled={!config} onClick={() => setCreating(true)}>
              Create room
            </button>
          </div>
          <div className="card">
            <h2>Join a private room</h2>
            <JoinPrivateForm config={config} />
          </div>
        </aside>
      </main>

      {creating && config && <CreateRoomDialog config={config} onClose={() => setCreating(false)} />}
    </div>
  )
}
