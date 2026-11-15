import { useCallback, useEffect, useRef, useState } from 'react'
import { roomsApi, type RoomFilters, type RoomView } from '../lib/rooms'

/**
 * How often an open lobby re-checks the room list. Every check is an authenticated API request
 * (a database lookup per person), so this is deliberately slow: the Refresh button is there for
 * "I want to see it now".
 */
export const POLL_MS = 30_000
/** After a failed load, try again sooner than a normal poll. */
export const RETRY_MS = 8_000
/** Coming back to the tab refreshes at once if the list is older than this. */
export const STALE_MS = 15_000

/**
 * The room list for the lobby, kept reasonably fresh without hammering the API:
 * - polls every POLL_MS, but not while the tab is in the background;
 * - coming back to the tab refreshes immediately if the list has gone stale;
 * - a failed load is retried after RETRY_MS instead of waiting a full poll;
 * - `refresh()` loads now (and restarts the poll clock).
 * A response that arrives after a newer request, or after the filters changed, is dropped.
 */
export function useRoomList(filters: RoomFilters) {
  const [rooms, setRooms] = useState<RoomView[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  /** points at the current effect's load(), so the button can call it */
  const loadNow = useRef<() => void>(() => {})

  useEffect(() => {
    let alive = true
    let seq = 0 // a newer request supersedes an older one
    let loadedAt = 0
    let failed = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(tick, ms)
    }
    // In the background: do nothing and do not reschedule. onVisible() restarts the clock.
    const tick = () => {
      if (!document.hidden) void load()
    }

    const load = async () => {
      clearTimeout(timer)
      const mine = ++seq
      try {
        const list = await roomsApi.list(filters)
        if (!alive || mine !== seq) return
        setRooms(list)
        setLoadError(false)
        failed = false
        loadedAt = Date.now()
      } catch {
        if (!alive || mine !== seq) return
        setLoadError(true)
        failed = true
      } finally {
        if (alive && mine === seq) {
          setRefreshing(false)
          schedule(failed ? RETRY_MS : POLL_MS)
        }
      }
    }

    const onVisible = () => {
      if (document.hidden) return
      if (Date.now() - loadedAt > STALE_MS) void load()
      else schedule(POLL_MS)
    }

    loadNow.current = () => void load()
    document.addEventListener('visibilitychange', onVisible)
    void load()
    return () => {
      alive = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [filters])

  const refresh = useCallback(() => {
    setRefreshing(true)
    loadNow.current()
  }, [])

  return { rooms, loadError, refreshing, refresh }
}
