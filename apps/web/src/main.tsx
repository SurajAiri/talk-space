import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/instrument-sans'
import './index.css'
import App from './App.tsx'
import { watchVirtualKeyboard } from './lib/virtualKeyboard'

watchVirtualKeyboard()

// Dev only: draw a stand-in for the host's "Powered by Netlify" badge (VITE_DEV_HOST_BADGE=true in .env).
// `import.meta.env.DEV` is a build-time constant, so production bundles contain none of this.
if (import.meta.env.DEV && import.meta.env.VITE_DEV_HOST_BADGE === 'true') {
  void import('./dev/hostBadgeSim').then((m) => m.mountHostBadgeSim())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
