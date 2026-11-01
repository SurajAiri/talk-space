import { api, type Gender, type User } from './api'
import { useAuthStore } from '../store/auth.store'
import type { Option } from './rooms'

export type { Gender }

/** What the forms offer and how much they accept. Served by the API (apps/api/src/config/profile.config.ts). */
export interface ProfileOptions {
  bioMax: number
  maxLanguages: number
  maxInterests: number
  maxSkills: number
  label: { min: number; max: number }
  genders: { value: Gender; label: string }[]
  languages: Option[]
  interestSuggestions: string[]
  skillSuggestions: string[]
}

export interface OnboardingInput {
  gender: Gender
  spokenLanguages: string[]
  interests: string[]
  skills: string[]
  /** may be empty: the bio is the one optional answer */
  bio: string
}

/** Only the fields that changed. */
export type ProfilePatch = Partial<{
  name: string
  username: string
  gender: Gender
  bio: string
  spokenLanguages: string[]
  interests: string[]
  skills: string[]
}>

const token = () => useAuthStore.getState().token

export const profileApi = {
  options: () => api<ProfileOptions>('/users/options', { token: token() }),
  completeOnboarding: (input: OnboardingInput) =>
    api<User>('/users/me/onboarding', { method: 'POST', body: input, token: token() }),
  update: (patch: ProfilePatch) => api<User>('/users/me', { method: 'PATCH', body: patch, token: token() }),
}

let optionsPromise: Promise<ProfileOptions> | null = null
/** The options are static per server start, so fetch them once. */
export function loadProfileOptions(): Promise<ProfileOptions> {
  optionsPromise ??= profileApi.options().catch((err) => {
    optionsPromise = null
    throw err
  })
  return optionsPromise
}

/** Language codes ("ne") to names ("Nepali"); unknown codes are shown as they are. */
export function languageNames(options: ProfileOptions | null, codes: string[]): string[] {
  return codes.map((c) => options?.languages.find((l) => l.value === c)?.label ?? c)
}

export function genderLabel(options: ProfileOptions | null, gender: Gender | null): string | null {
  if (!gender) return null
  return options?.genders.find((g) => g.value === gender)?.label ?? null
}
