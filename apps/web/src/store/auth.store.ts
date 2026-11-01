import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, ApiError, type User } from '../lib/api'
import { authClient } from '../lib/auth-client'
import { API_URL } from '../lib/config'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** How often loadUser retries when the API can't be reached (still starting, waking up, brief outage). */
const LOAD_RETRIES = 5
const LOAD_RETRY_DELAY_MS = 2000

interface AuthState {
  token: string | null
  user: User | null
  /** true until the stored token has been checked once */
  initializing: boolean
  submitting: boolean

  loadUser: () => Promise<void>
  setToken: (token: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (input: {
    name: string
    username: string
    email: string
    password: string
    /** the sign-up form's checkbox; the API refuses anything but true */
    acceptPrivacyPolicy: boolean
  }) => Promise<void>
  signInWithGoogle: () => Promise<void>
  /** Replaces the signed-in user, e.g. with the fresh copy the API returns after a profile change. */
  setUser: (user: User) => void
  /** Changes the password. The API signs out every other device and hands this one a fresh token. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  /** Swaps the current token for a fresh one. Tokens are short-lived, so this runs quietly in the background. */
  refresh: () => Promise<void>
  logout: () => void
  /** Ends every session of this account, on every device. */
  logoutEverywhere: () => Promise<void>
}

// Only the token is persisted; the user is re-fetched from /users/me.
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      initializing: true,
      submitting: false,

      loadUser: async () => {
        const { token } = get()
        if (!token) {
          set({ user: null, initializing: false })
          return
        }
        for (let attempt = 0; ; attempt++) {
          try {
            const user = await api<User>('/users/me', { token })
            set({ user, initializing: false })
            void get().refresh()
            return
          } catch (err) {
            // The API simply isn't answering yet: wait and try again instead of bouncing a
            // signed-in person to the login page. Gives up quietly after a few tries.
            if (err instanceof ApiError && err.isNetworkError && attempt < LOAD_RETRIES) {
              await sleep(LOAD_RETRY_DELAY_MS)
              if (get().token !== token) {
                // logged out / replaced meanwhile: whoever changed it owns the next step
                set({ initializing: false })
                return
              }
              continue
            }
            // invalid/expired token -> logged out; other errors keep the token
            if (err instanceof ApiError && err.status === 401) {
              set({ token: null, user: null })
            }
            set({ initializing: false })
            return
          }
        }
      },

      setToken: async (token) => {
        set({ token })
        await get().loadUser()
      },

      login: async (email, password) => {
        set({ submitting: true })
        try {
          const res = await api<{ token: string }>('/auth/login', {
            method: 'POST',
            body: { email, password },
          })
          await get().setToken(res.token)
        } finally {
          set({ submitting: false })
        }
      },

      register: async (input) => {
        set({ submitting: true })
        try {
          const res = await api<{ token: string }>('/auth/register', {
            method: 'POST',
            body: input,
          })
          await get().setToken(res.token)
        } finally {
          set({ submitting: false })
        }
      },

      // Redirects to Google; the API then redirects back to <this site>/auth/callback with our JWT.
      signInWithGoogle: async () => {
        const { error } = await authClient.signIn.social({
          provider: 'google',
          // The API finishes the handshake and sends the browser back to this site, so both
          // addresses must be absolute now that the API lives on its own origin.
          callbackURL: `${API_URL}/api/v1/auth/google/complete`,
          errorCallbackURL: `${window.location.origin}/auth`,
        })
        if (error) throw new Error(error.message ?? 'Failed to continue with Google')
      },

      setUser: (user) => set({ user }),

      changePassword: async (currentPassword, newPassword) => {
        const { token } = get()
        const res = await api<{ token: string }>('/auth/change-password', {
          method: 'POST',
          body: { currentPassword, newPassword },
          token,
        })
        set({ token: res.token })
      },

      refresh: async () => {
        const { token } = get()
        if (!token) return
        try {
          const res = await api<{ token: string }>('/auth/refresh', { method: 'POST', body: {}, token })
          // only swap if nothing changed underneath us (logout, another refresh)
          if (get().token === token) set({ token: res.token })
        } catch (err) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            set({ token: null, user: null })
          }
          // network errors / rate limits: keep the current token, try again later
        }
      },

      logout: () => set({ token: null, user: null }),

      logoutEverywhere: async () => {
        const { token } = get()
        if (token) await api('/auth/logout-everywhere', { method: 'POST', body: {}, token })
        set({ token: null, user: null })
      },
    }),
    {
      name: 'auth',
      partialize: (s) => ({ token: s.token }),
    },
  ),
)
