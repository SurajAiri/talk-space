import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    port: 5173,
    // ws: true lets the signaling WebSocket (/api/v1/realtime) through the proxy
    proxy: { '/api': { target: 'http://localhost:3000', ws: true } },
  },
})
