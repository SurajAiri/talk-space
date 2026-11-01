import { useEffect, useRef, useState, type ReactNode, type Ref, type SyntheticEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import Avatar from '../components/Avatar'
import ChipPicker from '../components/form/ChipPicker'
import { TextArea } from '../components/form/fields'
import {
  AlertIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  GlobeIcon,
  HeartIcon,
  SparklesIcon,
  UserIcon,
  ZapIcon,
} from '../components/Icons'
import { LogoMark } from '../components/Logo'
import Backdrop from '../components/OnboardingBackdrop'
import GenderPicker from '../components/profile/GenderPicker'
import { useProfileOptions } from '../hooks/useProfileOptions'
import type { Gender, User } from '../lib/api'
import { languageNames, profileApi, type ProfileOptions } from '../lib/profile'
import { validateBio } from '../lib/validation'
import { useAuthStore } from '../store/auth.store'

const STEPS = 3
/** How long the "all set" screen stays before moving on by itself. */
const DONE_MS = 2400

export default function OnboardingPage() {
  const user = useAuthStore((s) => s.user)
  const { options, failed, retry } = useProfileOptions()

  if (options && user) return <OnboardingFlow user={user} options={options} />

  return (
    <Backdrop>
      <div className="onb-card onb-card-small" role={failed ? 'alert' : 'status'}>
        {failed ? (
          <>
            <span className="onb-badge onb-badge-warn">
              <AlertIcon size={24} />
            </span>
            <h1 className="onb-title">We couldn’t load this page</h1>
            <p className="onb-lead">Check your connection and try again.</p>
            <button type="button" className="btn" onClick={retry}>
              Try again
            </button>
          </>
        ) : (
          <div className="splash">
            <LogoMark size={44} />
            <p>Getting things ready…</p>
          </div>
        )}
      </div>
    </Backdrop>
  )
}

interface FormState {
  gender: Gender | null
  spokenLanguages: string[]
  interests: string[]
  skills: string[]
  bio: string
}

/**
 * Brings the first error message into view by scrolling the card's body, and nothing else.
 * (scrollIntoView would also scroll the page behind the card, and always re-centres.)
 */
function revealFirstProblem(container: HTMLElement | null) {
  const problem = container?.querySelector<HTMLElement>('[role="alert"]')
  if (!container || !problem) return
  const box = container.getBoundingClientRect()
  const at = problem.getBoundingClientRect()
  const margin = 24
  if (at.top < box.top + margin) container.scrollTop += at.top - box.top - margin
  else if (at.bottom > box.bottom - margin) container.scrollTop += at.bottom - box.bottom + margin
}

const STARTERS = ['I’m here to practise speaking.', 'Ask me about …', 'Coffee, long walks and good conversations.']

function StepIntro({
  icon,
  title,
  lead,
  headingRef,
}: {
  icon: ReactNode
  title: string
  lead: string
  headingRef: Ref<HTMLHeadingElement>
}) {
  return (
    <div className="onb-intro">
      <span className="onb-badge">{icon}</span>
      <h1 id="onb-title" ref={headingRef} tabIndex={-1} className="onb-title">
        {title}
      </h1>
      <p className="onb-lead">{lead}</p>
    </div>
  )
}

function OnboardingFlow({ user, options }: { user: User; options: ProfileOptions }) {
  const navigate = useNavigate()
  const location = useLocation()
  const setUser = useAuthStore((s) => s.setUser)

  const [step, setStep] = useState(0) // 0..2 are the questions, 3 is the "all set" screen
  const [dir, setDir] = useState<'forward' | 'back'>('forward')
  const [form, setForm] = useState<FormState>({ gender: null, spokenLanguages: [], interests: [], skills: [], bio: '' })
  const [attempted, setAttempted] = useState(false) // after a failed "Continue", this step shows every problem
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  /** The saved profile. It is only handed to the app when the person moves on, so this screen isn't pulled away early. */
  const [saved, setSaved] = useState<User | null>(null)

  const headingRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const firstName = user.name.trim().split(/\s+/)[0] || user.name
  // RouteGuards remembers where the person was heading (a shared room link, say)
  const from = (location.state as { from?: { pathname: string; search: string; state?: unknown } } | null)?.from
  const destination = from ? from.pathname + from.search : '/home'
  const destinationState = from?.state

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (saveError) setSaveError(null)
  }

  const errors = {
    gender: form.gender ? null : 'Choose one of the options',
    languages: form.spokenLanguages.length > 0 ? null : 'Pick at least one language',
    interests: form.interests.length > 0 ? null : 'Pick at least one interest',
    skills: form.skills.length > 0 ? null : 'Pick at least one thing you’re good at',
    bio: validateBio(form.bio, options.bioMax),
  }
  const stepErrors = [[errors.gender, errors.languages], [errors.interests, errors.skills], [errors.bio]]
  const blocked = (stepErrors[step] ?? []).some(Boolean)

  // Each step starts at the top, with the heading announced to screen readers.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
    headingRef.current?.focus({ preventScroll: true })
  }, [step])

  // After the "all set" screen has had its moment, move on by itself.
  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => {
      setUser(saved)
      navigate(destination, { replace: true, state: destinationState })
    }, DONE_MS)
    return () => clearTimeout(timer)
  }, [saved, setUser, navigate, destination, destinationState])

  function goTo(next: number) {
    setDir(next > step ? 'forward' : 'back')
    setStep(next)
    setAttempted(false)
  }

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return
    if (blocked) {
      setAttempted(true)
      // take the person straight to what needs attention
      setTimeout(() => revealFirstProblem(bodyRef.current), 0)
      return
    }
    if (step < STEPS - 1) return goTo(step + 1)

    if (!form.gender) return
    setSaving(true)
    setSaveError(null)
    try {
      const profile = await profileApi.completeOnboarding({
        gender: form.gender,
        spokenLanguages: form.spokenLanguages,
        interests: form.interests,
        skills: form.skills,
        bio: form.bio.trim(),
      })
      setDir('forward')
      setStep(STEPS)
      setSaved(profile)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function addStarter(text: string) {
    const current = form.bio.trim()
    const next = current ? `${current} ${text}` : text
    if (next.length <= options.bioMax) set('bio')(next)
  }

  const done = step === STEPS
  const shownLanguages = languageNames(options, form.spokenLanguages)
  const MAX_PREVIEW = 4

  return (
    <Backdrop>
      <form className="onb-card" onSubmit={onSubmit} noValidate aria-labelledby="onb-title">
        <div className="onb-head">
          <div
            className="onb-progress"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuemin={1}
            aria-valuemax={STEPS}
            aria-valuenow={Math.min(step + 1, STEPS)}
            aria-valuetext={done ? 'Finished' : `Step ${step + 1} of ${STEPS}`}
          >
            {Array.from({ length: STEPS }, (_, i) => (
              <i key={i} className={i < step ? 'is-done' : i === step ? 'is-current' : ''} />
            ))}
          </div>
          <span className="onb-count" aria-hidden="true">
            {done ? 'All done' : `Step ${step + 1} of ${STEPS}`}
          </span>
        </div>

        {done ? (
          <div className="onb-body onb-done" role="status">
            <span className="onb-done-ring" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path className="onb-done-check" d="m5 12.5 4.5 4.5L19 7.5" pathLength={1} />
              </svg>
            </span>
            <h1 id="onb-title" ref={headingRef} tabIndex={-1} className="onb-title">
              You’re all set, {firstName}
            </h1>
            <p className="onb-lead">Your profile is ready. You can change any of it later from your profile page.</p>
            <button
              type="button"
              className="btn btn-lg"
              onClick={() => {
                if (!saved) return
                setUser(saved)
                navigate(destination, { replace: true, state: destinationState })
              }}
            >
              Let’s go
              <ArrowRightIcon size={18} />
            </button>
          </div>
        ) : (
          <>
            <div className="onb-body" ref={bodyRef}>
              {step === 0 && (
                <section className="onb-step" data-dir={dir}>
                  <StepIntro
                    headingRef={headingRef}
                    icon={<UserIcon size={24} />}
                    title={`Nice to meet you, ${firstName}`}
                    lead="Two quick questions, so people know who they’re talking to."
                  />
                  <div className="onb-fields">
                    <GenderPicker
                      options={options.genders}
                      value={form.gender}
                      onChange={set('gender')}
                      error={errors.gender}
                      showError={attempted}
                    />
                    <ChipPicker
                      label="Languages you speak"
                      icon={<GlobeIcon size={17} />}
                      hint="Pick everything you can hold a conversation in."
                      noun="language"
                      options={options.languages}
                      selected={form.spokenLanguages}
                      onChange={set('spokenLanguages')}
                      max={options.maxLanguages}
                      searchLabel="Search languages"
                      initiallyVisible={12}
                      error={errors.languages}
                      showError={attempted}
                    />
                  </div>
                </section>
              )}

              {step === 1 && (
                <section className="onb-step" data-dir={dir}>
                  <StepIntro
                    headingRef={headingRef}
                    icon={<SparklesIcon size={24} />}
                    title="What makes you, you?"
                    lead="Pick a few interests and things you’re good at. They give people an easy way to start talking to you."
                  />
                  <div className="onb-fields">
                    <ChipPicker
                      label="Interests"
                      icon={<HeartIcon size={17} />}
                      hint="Tap to choose, or add your own."
                      noun="interest"
                      options={options.interestSuggestions.map((v) => ({ value: v, label: v }))}
                      selected={form.interests}
                      onChange={set('interests')}
                      max={options.maxInterests}
                      custom={{ min: options.label.min, max: options.label.max, placeholder: 'Add your own, e.g. Chess' }}
                      initiallyVisible={12}
                      error={errors.interests}
                      showError={attempted}
                    />
                    <ChipPicker
                      label="Things you’re good at"
                      icon={<ZapIcon size={17} />}
                      hint="Big or small: a good listener counts."
                      noun="skill"
                      options={options.skillSuggestions.map((v) => ({ value: v, label: v }))}
                      selected={form.skills}
                      onChange={set('skills')}
                      max={options.maxSkills}
                      custom={{ min: options.label.min, max: options.label.max, placeholder: 'Add your own, e.g. Karaoke' }}
                      initiallyVisible={10}
                      error={errors.skills}
                      showError={attempted}
                    />
                  </div>
                </section>
              )}

              {step === 2 && (
                <section className="onb-step" data-dir={dir}>
                  <StepIntro
                    headingRef={headingRef}
                    icon={<UserIcon size={24} />}
                    title="Anything you’d like to add?"
                    lead="A line or two is plenty. This one is optional, and you can add it later."
                  />
                  <div className="onb-fields">
                    <div className="stack">
                      <TextArea
                        label="About you"
                        optional
                        rows={4}
                        maxLength={options.bioMax}
                        value={form.bio}
                        onValueChange={set('bio')}
                        error={errors.bio}
                        showError={attempted}
                        placeholder="e.g. Language nerd who loves late-night chats about music."
                      />
                      <div className="reasons" aria-label="Ideas to start from">
                        {STARTERS.map((text) => (
                          <button key={text} type="button" className="reason" onClick={() => addStarter(text)}>
                            {text}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="onb-preview-wrap">
                      <p className="onb-preview-title">How others will see you</p>
                      <div className="onb-preview">
                        <Avatar name={user.name} size={52} />
                        <div className="onb-preview-main">
                          <p className="onb-preview-name">
                            <strong>{user.name}</strong>
                            <span>@{user.username}</span>
                          </p>
                          <p className={form.bio.trim() ? 'onb-preview-bio' : 'onb-preview-bio is-empty'}>
                            {form.bio.trim() || 'Your bio will show up here.'}
                          </p>
                          <div className="chips">
                            {shownLanguages.slice(0, MAX_PREVIEW).map((l) => (
                              <span key={l} className="chip chip-neutral">
                                <GlobeIcon size={12} />
                                {l}
                              </span>
                            ))}
                            {form.interests.slice(0, MAX_PREVIEW).map((i) => (
                              <span key={i} className="chip">
                                {i}
                              </span>
                            ))}
                            {shownLanguages.length + form.interests.length > MAX_PREVIEW * 2 && (
                              <span className="chip chip-tag">
                                +{Math.max(0, shownLanguages.length - MAX_PREVIEW) + Math.max(0, form.interests.length - MAX_PREVIEW)} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {saveError && (
                      <p className="notice notice-error" role="alert">
                        <AlertIcon size={16} />
                        {saveError}
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="onb-foot">
              {step > 0 ? (
                <button type="button" className="btn btn-ghost" onClick={() => goTo(step - 1)} disabled={saving}>
                  <ChevronLeftIcon size={17} />
                  Back
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className={`btn btn-lg ${step === STEPS - 1 && !form.bio.trim() ? 'btn-outline' : ''}`} disabled={saving}>
                {saving && <span className="spinner" aria-hidden="true" />}
                {saving ? 'Saving…' : step < STEPS - 1 ? 'Continue' : form.bio.trim() ? 'Finish' : 'Skip and finish'}
                {!saving && (step < STEPS - 1 ? <ArrowRightIcon size={18} /> : <CheckIcon size={18} />)}
              </button>
            </div>
          </>
        )}
      </form>
    </Backdrop>
  )
}
