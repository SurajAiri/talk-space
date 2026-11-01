import { useSyncExternalStore } from 'react'

/** Subscribes to a CSS media query (and re-renders when it flips, e.g. when a phone is rotated). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', notify)
      return () => mql.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** A finger rather than a mouse: show the joystick, use bigger targets. */
export const useCoarsePointer = () => useMediaQuery('(pointer: coarse)')
/** Short screens (a phone held sideways): panels and bars shrink to leave the map visible. */
export const useShortScreen = () => useMediaQuery('(max-height: 520px)')
/** Phone-width screens: panels become bottom sheets and the controls move within thumb reach. */
export const useNarrowScreen = () => useMediaQuery('(max-width: 720px)')
