import { useSyncExternalStore } from 'react'

type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> }

export const fullscreenSupported = () => typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen)

/**
 * Full screen, and (on phones, where the browser allows it) locked to landscape. Both need a user
 * gesture, so call this from a click handler. iPhones allow neither for web pages: the room then
 * asks people to turn the phone instead (see RotatePrompt).
 */
export async function enterImmersive(landscape: boolean) {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
  } catch {
    /* refused or unsupported: the room still works, just with browser chrome */
  }
  if (landscape) {
    try {
      await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape')
    } catch {
      /* orientation lock is not available everywhere */
    }
  }
}

export async function exitImmersive() {
  try {
    ;(screen.orientation as { unlock?: () => void } | undefined)?.unlock?.()
  } catch {
    /* ignore */
  }
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
