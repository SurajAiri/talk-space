import { API_URL } from './config'

export type Gender = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say'

export interface User {
  id: string
  name: string
  username: string
  email: string
  bio: string | null
  gender: Gender | null
  spokenLanguages: string[]
  interests: string[]
  skills: string[]
  reputationScore: number
  strikes: number
  status: 'active' | 'suspended' | 'banned'
  userType: 'user' | 'admin'
  /** null until the onboarding questions are answered */
  onboardedAt: string | null
  /** when the person accepted the Privacy Policy, and which version; null = never */
  privacyPolicyAcceptedAt: string | null
  privacyPolicyVersion: string | null
  /** true until the CURRENT version is accepted (never accepted, or the policy has changed since) */
  needsPrivacyConsent: boolean
  /** false for accounts that sign in with Google only */
  hasPassword: boolean
  createdAt: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
  /** The request never got an answer (API down or starting up, offline, blocked by CORS). */
  get isNetworkError() {
    return this.status === 0
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.")
  }
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, json?.message ?? 'Request failed')
  return (json?.data ?? null) as T
}
