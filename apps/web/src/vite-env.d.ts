/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API, e.g. https://api.yourdomain.com (no trailing slash, no /api/v1). */
  readonly VITE_API_URL?: string
  /** dev only: "true" draws a stand-in for the host's "Powered by Netlify" badge (see src/dev/hostBadgeSim.ts) */
  readonly VITE_DEV_HOST_BADGE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
