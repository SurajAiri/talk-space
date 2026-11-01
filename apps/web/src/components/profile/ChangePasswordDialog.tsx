import { useRef, useState, type SyntheticEvent } from 'react'
import { toast } from 'sonner'
import { useModal } from '../../hooks/useModal'
import { validateConfirmation, validateExistingPassword, validateNewPassword } from '../../lib/validation'
import { useAuthStore } from '../../store/auth.store'
import { PasswordField } from '../form/fields'
import { AlertIcon, InfoIcon, KeyIcon, LockIcon, XIcon } from '../Icons'

/** Asks for the current password (so a borrowed, unlocked laptop can't be used to take over the account). */
export default function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const changePassword = useAuthStore((s) => s.changePassword)
  const dialogRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const errors = {
    current: validateExistingPassword(form.current),
    next:
      validateNewPassword(form.next) ??
      (form.current && form.next === form.current ? 'Choose one that’s different from your current password' : null),
    confirm: validateConfirmation(form.next, form.confirm),
  }
  const hasErrors = Object.values(errors).some(Boolean)

  useModal(dialogRef, onClose, !saving)

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (formError) setFormError(null)
  }

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return
    setAttempted(true)
    if (hasErrors) {
      setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0)
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await changePassword(form.current, form.next)
      toast.success('Password changed. Your other devices have been logged out.')
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not change your password')
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="card modal" role="dialog" aria-modal="true" aria-labelledby="pw-title" ref={dialogRef}>
        <div className="modal-head">
          <h2 id="pw-title">Change password</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>
        <form className="modal-form" onSubmit={onSubmit} noValidate>
          <div className="modal-body">
            {formError && (
              <p className="notice notice-error" role="alert">
                <AlertIcon size={16} />
                {formError}
              </p>
            )}
            <PasswordField
              label="Current password"
              icon={<KeyIcon size={18} />}
              value={form.current}
              onValueChange={set('current')}
              error={errors.current}
              showError={attempted}
              autoComplete="current-password"
              autoFocus
            />
            <PasswordField
              label="New password"
              icon={<LockIcon size={18} />}
              value={form.next}
              onValueChange={set('next')}
              error={errors.next}
              showError={attempted}
              meter
              hint="At least 8 characters. A longer phrase beats a clever short one."
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirm new password"
              icon={<LockIcon size={18} />}
              value={form.confirm}
              onValueChange={set('confirm')}
              error={errors.confirm}
              showError={attempted}
              autoComplete="new-password"
            />
            <p className="notice">
              <InfoIcon size={16} />
              For your safety, you’ll stay logged in here and be logged out everywhere else.
            </p>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving && <span className="spinner" aria-hidden="true" />}
              {saving ? 'Changing…' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
