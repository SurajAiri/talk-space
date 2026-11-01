import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig, loadEnv } from 'vite'
import { mapEditorPlugin } from './tools/vite-plugin-map-editor.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // A production bundle without an API address would call localhost from every visitor's
  // browser. Fail the build instead of shipping that. (Also picks up variables set in the
  // host's dashboard, e.g. Vercel / Netlify / Cloudflare.)
  if (mode === 'production') {
    const { VITE_API_URL } = loadEnv(mode, import.meta.dirname, 'VITE_')
    if (!VITE_API_URL?.trim()) {
      throw new Error(
        'VITE_API_URL is not set. Set it to the API origin (e.g. https://api.yourdomain.com) ' +
          'in your host\'s environment variables before building.',
      )
    }
  }

  return {
    plugins: [
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
