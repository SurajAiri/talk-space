import { useState, type SyntheticEvent } from 'react'
import { CheckboxField } from '../components/form/fields'
import { AlertIcon, ArrowRightIcon, ShieldIcon } from '../components/Icons'
import Backdrop from '../components/OnboardingBackdrop'
import { APP_NAME, policyDate, PRIVACY_POLICY_PATH } from '../lib/legal'
import { profileApi } from '../lib/profile'
import { validatePrivacyConsent } from '../lib/validation'
import { useAuthStore } from '../store/auth.store'

/**
 * Shown, in place of the app, to anyone who has not accepted the CURRENT Privacy Policy: people who
 * signed up with Google (they never saw it), accounts that predate it, and everyone again when it
 * changes. See ConsentRoute in components/RouteGuards. There is no way past it except accepting
 * (or logging out), and the API records when.
 */
export default function PrivacyConsentPage() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  const [accepted, setAccepted] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // They accepted an older text once: say the policy changed rather than greeting them like a stranger.
  const updated = Boolean(user?.privacyPolicyAcceptedAt)
  const firstName = user?.name.trim().split(/\s+/)[0] || user?.name || ''
  const problem = validatePrivacyConsent(accepted)

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return
    if (problem) {
      setAttempted(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      // The fresh copy of the account says the policy is accepted, which lets the route guard through.
      setUser(await profileApi.acceptPrivacyPolicy())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <Backdrop>
      <form className="onb-card onb-card-fit" onSubmit={onSubmit} noValidate aria-labelledby="consent-title">
        <div className="onb-body">
          <div className="onb-intro">
            <span className="onb-badge">
              <ShieldIcon size={24} />
            </span>
            <h1 id="consent-title" className="onb-title">
              {updated ? 'We’ve updated our Privacy Policy' : `Welcome to ${APP_NAME}${firstName ? `, ${firstName}` : ''}`}
            </h1>
            <p className="onb-lead">
              {updated
                ? `The current version is dated ${policyDate()}. Please read it and accept it to carry on.`
                : 'Before you start, please read how we handle your information and accept our Privacy Policy.'}
            </p>
          </div>

          <ul className="consent-points" aria-label="The short version">
            <li>
              <strong>What we keep.</strong> Your name, username, email and the answers you give for your profile.
            </li>
            <li>
              <strong>What we don’t.</strong> Voice, chat and movement go straight between people in a room. We don’t
              record or store them.
            </li>
            <li>
              <strong>Your say.</strong> Edit your profile any time, or ask us to delete your account.
            </li>
          </ul>

          <div className="consent-box">
            <CheckboxField checked={accepted} onChange={setAccepted} error={problem} showError={attempted}>
              I have read and accept the{' '}
              <a href={PRIVACY_POLICY_PATH} target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              .
            </CheckboxField>
          </div>

          {error && (
            <p className="notice notice-error" role="alert">
              <AlertIcon size={16} />
              {error}
            </p>
          )}
        </div>

        <div className="onb-foot">
          <span className="onb-foot-note">You can’t use {APP_NAME} without accepting.</span>
          <button type="submit" className="btn btn-lg" disabled={saving}>
            {saving && <span className="spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Accept and continue'}
            {!saving && <ArrowRightIcon size={18} />}
          </button>
        </div>
      </form>
    </Backdrop>
  )
}
