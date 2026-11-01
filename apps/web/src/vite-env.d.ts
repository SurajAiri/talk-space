/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API, e.g. https://api.yourdomain.com (no trailing slash, no /api/v1). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
