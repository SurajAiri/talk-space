import { useSyncExternalStore } from 'react'

export const fullscreenSupported = () => typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen)

/** Full screen is always something the person asks for (a button): it is never switched on for them. */
export async function enterFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    /* refused or unsupported: the room works fine without it */
  }
}

export async function exitFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    /* ignore */
  }
}

export function useIsFullscreen(): boolean {
  return useSyncExternalStore(
    (notify) => {
      document.addEventListener('fullscreenchange', notify)
      return () => document.removeEventListener('fullscreenchange', notify)
    },
    () => Boolean(document.fullscreenElement),
    () => false,
  )
}
