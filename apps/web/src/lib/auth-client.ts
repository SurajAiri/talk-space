import { createAuthClient } from 'better-auth/react'

// Only used to start the Google OAuth flow (see apps/api/src/lib/better-auth.ts).
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/v1/better-auth',
})
