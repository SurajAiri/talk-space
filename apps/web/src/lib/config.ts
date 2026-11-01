/**
 * Where the API lives (set VITE_API_URL in apps/web/.env, see .env.example).
 * The browser talks to it directly: there is no dev proxy, so local dev and production
 * behave the same way (and the API must allow this site's origin, see WEB_URL in apps/api/.env).
 *
 * Production builds refuse to start without it (see vite.config.ts), so the localhost
 * fallback below can only ever apply to `pnpm dev`.
 */
const raw = import.meta.env.VITE_API_URL?.trim()

export const API_URL = (raw || 'http://localhost:3000').replace(/\/+$/, '')

/** Path of the Socket.IO signaling endpoint on the API. */
export const SOCKET_PATH = '/api/v1/realtime'
