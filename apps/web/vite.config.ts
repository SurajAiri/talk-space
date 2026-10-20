import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // HTTPS=1 pnpm dev -> https://<lan-ip>:5173 so phones get microphone access
    ...(process.env.HTTPS ? [basicSsl()] : []),
  ],
  server: {
    host: true, // reachable from your phone on the LAN
    port: 5173,
    // ws: true lets the signaling WebSocket (/api/v1/realtime) through the proxy
    proxy: { '/api': { target: 'http://localhost:3000', ws: true } },
  },
})
