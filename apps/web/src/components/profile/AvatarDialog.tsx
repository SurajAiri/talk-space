import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useModal } from '../../hooks/useModal'
import type { User } from '../../lib/api'
import { profileApi } from '../../lib/profile'
import { useAuthStore } from '../../store/auth.store'
import {
  ACCESSORIES,
  avatarFromId,
  HAIR_COLORS,
  HAIR_STYLES,
  PANTS_COLORS,
  randomAvatar,
  resolveAvatar,
  sameAvatar,
  sanitizeAvatar,
  SHIRT_COLORS,
  SHIRT_STYLES,
  SKIN_TONES,
  type AvatarConfig,
  type Choice,
} from '../../world/avatar'
import { EMOTES } from '../../world/fx'
import type { Dir } from '../../world/types'
import CharacterCanvas from '../CharacterCanvas'
import { AlertIcon, XIcon } from '../Icons'

const TURN: Record<Dir, Dir> = { down: 'left', left: 'up', up: 'right', right: 'down' }

function Swatches({ label, colors, value, onChange }: { label: string; colors: readonly string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div className="avd-swatches" role="radiogroup" aria-label={label}>
      {colors.map((c, i) => (
        <button
          key={c + i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${label} ${i + 1}`}
          className="avd-swatch"
          style={{ background: c }}
          onClick={() => onChange(i)}
        />
      ))}
    </div>
  )
}

/** Option tiles: each shows YOUR character wearing that option, so you see the result before picking it. */
function Tiles({
  label,
  options,
  value,
  draft,
  field,
  head,
  onChange,
}: {
  label: string
  options: readonly Choice[]
  value: string
  draft: AvatarConfig
  field: 'hairStyle' | 'shirtStyle' | 'accessory'
  head: boolean
  onChange: (id: string) => void
}) {
  return (
    <div className="avd-tiles" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="avd-tile" onClick={() => onChange(o.id)}>
          <span className="avd-tile-art">
            <CharacterCanvas look={resolveAvatar({ ...draft, [field]: o.id })} size={head ? 52 : 60} head={head} />
          </span>
          <span className="avd-tile-label">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Design your character. What you save is sent by the server to everyone in a room you join, so nobody
 * else's browser can change how you look. "Auto" means no saved design: the look generated from your account.
 */
export default function AvatarDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const setUser = useAuthStore((s) => s.setUser)
  const dialogRef = useRef<HTMLDivElement>(null)
  const saved = sanitizeAvatar(user.avatar)

  const [draft, setDraft] = useState<AvatarConfig>(() => saved ?? avatarFromId(user.id))
  const [auto, setAuto] = useState(saved === null)
  const [dir, setDir] = useState<Dir>('down')
  const [emote, setEmote] = useState<{ id: string; key: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = auto ? saved !== null : !sameAvatar(draft, saved)
  useModal(dialogRef, onClose, !dirty && !saving)

  const look = resolveAvatar(draft)
  const change = <K extends keyof AvatarConfig>(key: K) => (value: AvatarConfig[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setAuto(false)
    if (error) setError(null)
  }

  function randomise() {
    setDraft(randomAvatar())
    setAuto(false)
  }

  function useGenerated() {
    setDraft(avatarFromId(user.id))
    setAuto(true)
  }

  async function onSave() {
    if (saving || !dirty) return
    setSaving(true)
    setError(null)
    try {
      setUser(await profileApi.update({ avatar: auto ? null : draft }))
      toast.success(auto ? 'Back to your automatic look' : 'Character saved')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your character')
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !dirty && !saving && onClose()}>
      <div className="card modal modal-xl" role="dialog" aria-modal="true" aria-labelledby="avatar-title" ref={dialogRef}>
        <div className="modal-head">
          <h2 id="avatar-title">Your character</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>

        <div className="modal-body avd">
          <div className="avd-side">
            <button type="button" className="avd-stage" onClick={() => setDir(TURN[dir])} aria-label="Turn your character around" title="Click to turn around">
              <CharacterCanvas look={look} size={176} dir={dir} animate emote={emote} label="Preview of your character" />
            </button>
            <p className="hint avd-note">{auto ? 'Automatic look: made from your account.' : 'Click the preview to turn around.'}</p>

            <div className="avd-actions">
              <button type="button" className="btn btn-outline btn-small" onClick={randomise}>
                Randomise
              </button>
              <button type="button" className="btn btn-ghost btn-small" onClick={useGenerated} disabled={auto}>
                Use automatic look
              </button>
            </div>

            <div className="avd-emotes" role="group" aria-label="Try an emote">
              <span className="avd-emotes-title">Try an emote</span>
              <div>
                {EMOTES.map((e) => (
                  <button key={e.id} type="button" className="avd-emote" title={e.label} aria-label={e.label} onClick={() => setEmote({ id: e.id, key: (emote?.key ?? 0) + 1 })}>
                    {e.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="avd-options">
            {error && (
              <p className="notice notice-error" role="alert">
                <AlertIcon size={16} />
                {error}
              </p>
            )}

            <fieldset className="avd-group">
              <legend>Skin tone</legend>
              <Swatches label="Skin tone" colors={SKIN_TONES} value={draft.skin} onChange={change('skin')} />
            </fieldset>

            <fieldset className="avd-group">
              <legend>Hair</legend>
              <Tiles label="Hair style" options={HAIR_STYLES} value={draft.hairStyle} draft={draft} field="hairStyle" head onChange={change('hairStyle')} />
              <Swatches label="Hair colour" colors={HAIR_COLORS} value={draft.hairColor} onChange={change('hairColor')} />
            </fieldset>

            <fieldset className="avd-group">
              <legend>Outfit</legend>
              <Tiles label="Top" options={SHIRT_STYLES} value={draft.shirtStyle} draft={draft} field="shirtStyle" head={false} onChange={change('shirtStyle')} />
              <Swatches label="Top colour" colors={SHIRT_COLORS} value={draft.shirt} onChange={change('shirt')} />
              <span className="avd-sub">Trousers</span>
              <Swatches label="Trousers colour" colors={PANTS_COLORS} value={draft.pants} onChange={change('pants')} />
            </fieldset>

            <fieldset className="avd-group">
              <legend>Accessory</legend>
              <Tiles label="Accessory" options={ACCESSORIES} value={draft.accessory} draft={draft} field="accessory" head onChange={change('accessory')} />
            </fieldset>
          </div>
        </div>

        <div className="modal-foot">
          <span className="hint modal-foot-note" aria-live="polite">
            {dirty ? 'You have unsaved changes' : 'Everyone in a room sees this, the next time you join one'}
          </span>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={onSave} disabled={!dirty || saving}>
            {saving && <span className="spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save character'}
          </button>
        </div>
      </div>
    </div>
  )
}
