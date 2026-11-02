import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { mapEditorPlugin } from './tools/vite-plugin-map-editor.ts'

/** Where the app is served from when VITE_SITE_URL is not set. Only used for the link-preview picture's address. */
const DEFAULT_SITE_URL = 'https://space.hyekai.com'

/**
 * Link previews (WhatsApp, Telegram, Slack, X...) need the preview picture's FULL address, and the crawlers
 * that read it never run JavaScript. So index.html carries %SITE_URL% and it is filled in here, at build time.
 */
function siteUrlPlugin(siteUrl: string): Plugin {
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_')

  // A production bundle without an API address would call localhost from every visitor's
  // browser. Fail the build instead of shipping that. (Also picks up variables set in the
  // host's dashboard, e.g. Vercel / Netlify / Cloudflare.)
  if (mode === 'production' && !env.VITE_API_URL?.trim()) {
    throw new Error(
      'VITE_API_URL is not set. Set it to the API origin (e.g. https://api.yourdomain.com) ' +
        'in your host\'s environment variables before building.',
    )
  }

  const siteUrl = (env.VITE_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '')
  if (!/^https?:\/\/[^\s/]+$/.test(siteUrl)) {
    throw new Error(`VITE_SITE_URL must be an origin such as https://app.yourdomain.com (got "${siteUrl}").`)
  }

  return {
    plugins: [
      siteUrlPlugin(siteUrl),
      react(),
      mapEditorPlugin(), // dev only: lets the map editor save into src/world/maps/data
      babel({ presets: [reactCompilerPreset()] }),
      // HTTPS=1 pnpm dev -> https://<lan-ip>:5173 so phones get microphone access
      ...(process.env.HTTPS ? [basicSsl()] : []),
    ],
    server: {
      host: true, // reachable from your phone on the LAN
      port: 5173,
    },
  }
})
