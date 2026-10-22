import { useEffect, useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { roomsApi, type RoomConfig } from '../lib/rooms'
import { listWorldMaps, type RoomMapKey } from '../world/maps'

interface Props {
  config: RoomConfig
  onClose: () => void
}

/** Every map file in world/maps/data/, discovered at build time. */
const maps = listWorldMaps()

export default function CreateRoomDialog({ config, onClose }: Props) {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    shortDescription: '',
    language: config.languages[0]?.value ?? 'en',
    purpose: config.purposes[0]?.value ?? 'misc',
    tags: '',
    map: (maps[0]?.key ?? '') as RoomMapKey,
    visibility: 'public' as 'public' | 'private',
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set =
    (key: keyof typeof form) =>
    (e: { target: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const room = await roomsApi.create({
        ...form,
        tags: form.tags
          .split(',')
          .map((t) => t.trim().replace(/^#/, ''))
          .filter(Boolean),
      })
      // the join code travels in router state, not in the URL
      navigate(`/room/${room.id}`, { state: { joinCode: room.joinCode } })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the room')
      setSubmitting(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <h2 id="create-title">Start a room</h2>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            Title
            <input
              autoFocus
              required
              minLength={config.title.min}
              maxLength={config.title.max}
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Rust lifetimes, explained badly"
            />
          </label>
          <label className="field">
            Short description
            <input
              maxLength={config.shortDescriptionMax}
              value={form.shortDescription}
              onChange={set('shortDescription')}
              placeholder="What will you talk about?"
            />
          </label>
          <div className="row">
            <label className="field">
              Language
              <select value={form.language} onChange={set('language')}>
                {config.languages.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Purpose
              <select value={form.purpose} onChange={set('purpose')}>
                {config.purposes.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Tags (comma separated, up to {config.tags.max})
            <input value={form.tags} onChange={set('tags')} placeholder="rust, systems, compilers" />
          </label>
          <label className="field">
            Map
            <select value={form.map} onChange={set('map')}>
              {maps.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">
            People walk around the map. Inside a marked area everyone hears each other; out in the open
            you only hear people near you. Chat reaches the whole room.
          </p>
          <fieldset className="field choice">
            <legend>Who can join</legend>
            <label>
              <input
                type="radio"
                name="visibility"
                checked={form.visibility === 'public'}
                onChange={() => setForm((f) => ({ ...f, visibility: 'public' }))}
              />
              Anyone — listed in public rooms
            </label>
            <label>
              <input
                type="radio"
                name="visibility"
                checked={form.visibility === 'private'}
                onChange={() => setForm((f) => ({ ...f, visibility: 'private' }))}
              />
              Private — needs the room ID and join code
            </label>
          </fieldset>
          <p className="hint">Up to {config.maxMembers} people. The room ends when everyone leaves.</p>
          <div className="row row-end">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
