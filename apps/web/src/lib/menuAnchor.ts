export interface MenuAnchor {
  id: string
  /** where the click or tap landed, in screen (client) pixels */
  x: number
  y: number
}

interface Size {
  w: number
  h: number
}

/** The nearest the menu may come to a screen edge. */
export const MENU_MARGIN = 8

/** One axis. Prefer opening after the point (right / down), then before it (left / up), then slide to fit. Never off screen. */
function place(at: number, size: number, view: number, margin: number): number {
  const room = view - margin * 2
  if (size >= room) return margin // as big as the screen: pin it, and let it scroll
  if (at + size <= view - margin) return Math.max(margin, at) // fits after the point
  const end = Math.min(at, view - margin) // a point inside the margin counts as being at the margin
  if (end - size >= margin) return end - size // fits before it
  return view - margin - size // fits neither side: slide it in, covering the point rather than leaving the screen
}

/**
 * Top-left corner for a menu of `size` opened at (x, y) on a screen of `view`. A pure function of the three
 * measurements, so the awkward cases (a tap near an edge, a short landscape phone) are unit-tested, not guessed at.
 */
export function placeMenu(at: { x: number; y: number }, size: Size, view: Size, margin = MENU_MARGIN): { left: number; top: number } {
  return { left: place(at.x, size.w, view.w, margin), top: place(at.y, size.h, view.h, margin) }
}
