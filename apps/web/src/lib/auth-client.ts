import { createAuthClient } from 'better-auth/react'
import { API_URL } from './config'

// Only used to start the Google OAuth flow (see apps/api/src/lib/better-auth.ts).
// credentials: 'include' lets the API set the short-lived OAuth cookie it needs
// while the browser is away at Google.
export const authClient = createAuthClient({
  baseURL: API_URL,
  basePath: '/api/v1/better-auth',
  fetchOptions: { credentials: 'include' },
})
