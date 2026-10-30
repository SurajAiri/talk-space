/**
 * People this browser has blocked. Blocking is purely local (the other person is never told
 * and the server never hears about it), so it lives here, and survives reloads and new rooms.
 */
const KEY = 'talkspace.blocked'

export function loadBlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, 500) : [])
  } catch {
    return new Set()
  }
}

export function saveBlocked(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids].slice(-500)))
  } catch {
    /* private mode / storage full: blocking still works for this session */
  }
}
