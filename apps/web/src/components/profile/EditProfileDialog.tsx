import { useRef, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { useModal } from '../../hooks/useModal'
import { ApiError, type User } from '../../lib/api'
import { profileApi, type ProfileOptions, type ProfilePatch } from '../../lib/profile'
import { normalizeUsername, sameList, validateBio, validateName, validateUsername } from '../../lib/validation'
import { useAuthStore } from '../../store/auth.store'
import ChipPicker from '../form/ChipPicker'
import { TextArea, TextField } from '../form/fields'
import { AlertIcon, AtSignIcon, GlobeIcon, HeartIcon, UserIcon, XIcon, ZapIcon } from '../Icons'
import GenderPicker from './GenderPicker'

interface Props {
  user: User
  options: ProfileOptions
  onClose: () => void
}

/** Everything about you in one place. Only what you changed is sent. */
export default function EditProfileDialog({ user, options, onClose }: Props) {
  const setUser = useAuthStore((s) => s.setUser)
  const dialogRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    name: user.name,
    username: user.username,
    gender: user.gender,
    bio: user.bio ?? '',
    spokenLanguages: user.spokenLanguages,
    interests: user.interests,
    skills: user.skills,
  })
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [usernameTaken, setUsernameTaken] = useState<string | null>(null) // the username the server refused

  const errors = {
    name: validateName(form.name),
    username: validateUsername(form.username) ?? (usernameTaken === form.username ? 'That username is taken' : null),
    bio: validateBio(form.bio, options.bioMax),
  }
  const hasErrors = Object.values(errors).some(Boolean)

  const patch: ProfilePatch = {}
  if (form.name.trim() !== user.name) patch.name = form.name.trim()
  if (form.username !== user.username) patch.username = form.username
  if (form.gender && form.gender !== user.gender) patch.gender = form.gender
  if (form.bio.trim() !== (user.bio ?? '')) patch.bio = form.bio.trim()
  if (!sameList(form.spokenLanguages, user.spokenLanguages)) patch.spokenLanguages = form.spokenLanguages
  if (!sameList(form.interests, user.interests)) patch.interests = form.interests
  if (!sameList(form.skills, user.skills)) patch.skills = form.skills
  const dirty = Object.keys(patch).length > 0

  // Escape and clicks outside never throw away unsaved edits; Cancel and the cross are explicit.
  useModal(dialogRef, onClose, !dirty && !saving)

  const set = <K extends keyof typeof form>(key: K) => (value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: key === 'username' ? normalizeUsername(value as string) : value }))
    if (formError) setFormError(null)
  }

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving || !dirty) return
    setAttempted(true)
    if (hasErrors) {
      setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      setUser(await profileApi.update(patch))
      toast.success('Profile updated')
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setUsernameTaken(form.username)
        setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
      } else {
        setFormError(err instanceof Error ? err.message : 'Could not save your changes')
      }
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !dirty && !saving && onClose()}>
      <div className="card modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="edit-title" ref={dialogRef}>
        <div className="modal-head">
          <h2 id="edit-title">Edit profile</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>
        <form className="modal-form" onSubmit={onSubmit} noValidate>
          <div className="modal-body edit-body">
            {formError && (
              <p className="notice notice-error" role="alert">
                <AlertIcon size={16} />
                {formError}
              </p>
            )}

            <div className="row row-wrap">
              <TextField
                label="Name"
                icon={<UserIcon size={18} />}
                value={form.name}
                onValueChange={set('name')}
                error={errors.name}
                showError={attempted}
                maxLength={50}
                autoComplete="name"
                autoFocus
              />
              <TextField
                label="Username"
                icon={<AtSignIcon size={18} />}
                value={form.username}
                onValueChange={set('username')}
                error={errors.username}
                showError={attempted || usernameTaken === form.username}
                valid
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>

            <GenderPicker options={options.genders} value={form.gender} onChange={set('gender')} legend="Gender" />

            <ChipPicker
              label="Languages you speak"
              icon={<GlobeIcon size={17} />}
              noun="language"
              options={options.languages}
              selected={form.spokenLanguages}
              onChange={set('spokenLanguages')}
              max={options.maxLanguages}
              searchLabel="Search languages"
              initiallyVisible={12}
            />

            <ChipPicker
              label="Interests"
              icon={<HeartIcon size={17} />}
              noun="interest"
              options={options.interestSuggestions.map((v) => ({ value: v, label: v }))}
              selected={form.interests}
              onChange={set('interests')}
              max={options.maxInterests}
              custom={{ min: options.label.min, max: options.label.max, placeholder: 'Add your own' }}
              initiallyVisible={12}
            />

            <ChipPicker
              label="Things you’re good at"
              icon={<ZapIcon size={17} />}
              noun="skill"
              options={options.skillSuggestions.map((v) => ({ value: v, label: v }))}
              selected={form.skills}
              onChange={set('skills')}
              max={options.maxSkills}
              custom={{ min: options.label.min, max: options.label.max, placeholder: 'Add your own' }}
              initiallyVisible={10}
            />

            <TextArea
              label="About you"
              optional
              rows={3}
              maxLength={options.bioMax}
              value={form.bio}
              onValueChange={set('bio')}
              error={errors.bio}
              showError={attempted}
              placeholder="A line or two about you"
            />
          </div>
          <div className="modal-foot">
            <span className="hint modal-foot-note" aria-live="polite">
              {dirty ? 'You have unsaved changes' : ''}
            </span>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={!dirty || saving}>
              {saving && <span className="spinner" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
