import { useEffect, useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { roomsApi, type RoomConfig } from '../lib/rooms'
import { listWorldMaps, type RoomMapKey } from '../world/maps'
import { normalizeTag, validateTag } from '../lib/validation'
import { SelectField, TagInput, TextArea, TextField } from './form/fields'
import { CheckIcon, GlobeIcon, LockIcon, XIcon } from './Icons'
import MapThumb from './MapThumb'

interface Props {
  config: RoomConfig
  onClose: () => void
}

/** Every map file in world/maps/data/, discovered at build time. */
const maps = listWorldMaps()

export default function CreateRoomDialog({ config, onClose }: Props) {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [form, setForm] = useState({
    title: '',
    shortDescription: '',
    language: config.languages[0]?.value ?? 'en',
    purpose: config.purposes[0]?.value ?? 'misc',
    tags: [] as string[],
    map: (maps[0]?.key ?? '') as RoomMapKey,
    visibility: 'public' as 'public' | 'private',
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (key: 'title' | 'shortDescription' | 'language' | 'purpose') => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const titleError =
    form.title.trim().length < config.title.min ? `Give it a title of at least ${config.title.min} characters` : null

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setAttempted(true)
    if (titleError) {
      document.querySelector<HTMLElement>('.modal [aria-invalid="true"]')?.focus()
      return
    }
    setSubmitting(true)
    try {
      const room = await roomsApi.create({ ...form, title: form.title.trim() })
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
        <div className="modal-head">
          <h2 id="create-title">Start a room</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>
        <form className="modal-form" onSubmit={onSubmit} noValidate>
          <div className="modal-body">
            <TextField
              label="Title"
              autoFocus
              counter
              maxLength={config.title.max}
              value={form.title}
              onValueChange={set('title')}
              error={titleError}
              showError={attempted}
              placeholder="e.g. Rust lifetimes, explained badly"
            />
            <TextArea
              label="Short description"
              optional
              rows={2}
              maxLength={config.shortDescriptionMax}
              value={form.shortDescription}
              onValueChange={set('shortDescription')}
              placeholder="What will you talk about?"
            />
            <div className="row">
              <SelectField label="Language" icon={<GlobeIcon size={17} />} value={form.language} onValueChange={set('language')}>
                {config.languages.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Purpose" value={form.purpose} onValueChange={set('purpose')}>
                {config.purposes.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <TagInput
              label="Tags"
              optional
              tags={form.tags}
              onTagsChange={(tags) => setForm((f) => ({ ...f, tags }))}
              normalize={normalizeTag}
              validate={(t) => validateTag(t, config.tags.minLength, config.tags.maxLength)}
              max={config.tags.max}
              placeholder="rust, systems, compilers"
            />

            <fieldset className="field">
              <legend className="legend">Map</legend>
              <div className="pick-grid">
                {maps.map((m) => (
                  <label className="pick" key={m.key}>
                    <input type="radio" name="map" value={m.key} checked={form.map === m.key} onChange={() => setForm((f) => ({ ...f, map: m.key as RoomMapKey }))} />
                    <span className="pick-thumb">
                      <MapThumb mapKey={m.key} />
                    </span>
                    <span>{m.title}</span>
                    <span className="pick-check">
                      <CheckIcon size={13} strokeWidth={2.6} />
                    </span>
                  </label>
                ))}
              </div>
              <span className="field-hint">
                People walk around the map. Inside a marked area everyone hears each other; out in the open you only hear people near you.
              </span>
            </fieldset>

            <fieldset className="field">
              <legend className="legend">Who can join</legend>
              <div className="pick-row">
                <label className="pick pick-wide">
                  <input type="radio" name="visibility" checked={form.visibility === 'public'} onChange={() => setForm((f) => ({ ...f, visibility: 'public' }))} />
                  <GlobeIcon size={20} />
                  <span>
                    Public
                    <small>Anyone can find it in the room list.</small>
                  </span>
                  <span className="pick-check">
                    <CheckIcon size={13} strokeWidth={2.6} />
                  </span>
                </label>
                <label className="pick pick-wide">
                  <input type="radio" name="visibility" checked={form.visibility === 'private'} onChange={() => setForm((f) => ({ ...f, visibility: 'private' }))} />
                  <LockIcon size={20} />
                  <span>
                    Private
                    <small>Needs the room ID and join code.</small>
                  </span>
                  <span className="pick-check">
                    <CheckIcon size={13} strokeWidth={2.6} />
                  </span>
                </label>
              </div>
            </fieldset>
            <p className="hint">Up to {config.maxMembers} people. The room closes when everyone leaves.</p>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting && <span className="spinner" aria-hidden="true" />}
              {submitting ? 'Creating…' : 'Create room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
