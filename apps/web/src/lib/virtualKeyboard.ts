/**
 * Where does the on-screen keyboard go: OVER the bottom of the page, or does the page shrink to
 * make room? It matters for the host's "Powered by Netlify" badge (position: fixed, bottom-right):
 *
 * - keyboard drawn OVER the page (iOS Safari; Chrome on Android with interactive-widget=
 *   overlays-content or resizes-visual): the layout viewport keeps its height, so the badge sits
 *   under the keyboard, out of sight. Nothing needs to stay clear of it while typing.
 * - the page SHRINKS (this app asks for interactive-widget=resizes-content, see index.html):
 *   fixed elements move up with the bottom edge, so the badge rides right above the keyboard and
 *   still needs its room.
 *
 * The two are told apart by geometry alone: how much of the layout viewport (what `fixed` is measured
 * against) lies below the part that is actually on screen. That is ~0 without a keyboard, ~0 when the
 * page shrinks, and about the keyboard's height when it overlays. No user-agent sniffing, and the URL
 * bar showing or hiding does not register (it changes both heights alike).
 *
 * The result is the `data-keyboard-overlay` attribute on <html>, which index.css reads.
 */

/** The keyboard has to cover at least this much of the bottom to count (real ones are 200px or more). */
export const MIN_COVER_PX = 120

export interface KeyboardGeometry {
  /** window.innerHeight: the layout viewport, what `position: fixed` is measured against */
  layoutHeight: number
  /** visualViewport.height and .offsetTop: the part of the page that is on screen */
  visibleHeight: number
  visibleTop: number
  /** visualViewport.scale: above 1 when pinch-zoomed, where the heights say nothing about a keyboard */
  scale: number
  /** a text field has focus: without one there is no on-screen keyboard */
  editableFocused: boolean
}

export function keyboardCoversBottom(g: KeyboardGeometry): boolean {
  if (!g.editableFocused || g.scale > 1.05) return false
  return g.layoutHeight - (g.visibleTop + g.visibleHeight) >= MIN_COVER_PX
}

/** Fields that open a keyboard. (A <select> opens a picker, buttons and checkboxes open nothing.) */
const EDITABLE =
  'textarea, [contenteditable=""], [contenteditable="true"], ' +
  'input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio])' +
  ':not([type=range]):not([type=file]):not([type=color]):not([type=image]):not([type=hidden])'

export const isEditable = (el: Element | null): boolean => Boolean(el?.matches?.(EDITABLE))

/** Keeps `data-keyboard-overlay` on <html> up to date. Returns a function that stops it. */
export function watchVirtualKeyboard(): () => void {
  const vv = window.visualViewport
  if (!vv) return () => {}
  const root = document.documentElement

  const update = () => {
    root.toggleAttribute(
      'data-keyboard-overlay',
      keyboardCoversBottom({
        layoutHeight: window.innerHeight,
        visibleHeight: vv.height,
        visibleTop: vv.offsetTop,
        scale: vv.scale,
        editableFocused: isEditable(document.activeElement),
      }),
    )
  }
  // right after a focus change document.activeElement is not settled yet: look again on the next tick
  const settle = () => void setTimeout(update, 0)

  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
  window.addEventListener('resize', update)
  document.addEventListener('focusin', update)
  document.addEventListener('focusout', settle)
  update()
  return () => {
    vv.removeEventListener('resize', update)
    vv.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
    document.removeEventListener('focusin', update)
    document.removeEventListener('focusout', settle)
    root.removeAttribute('data-keyboard-overlay')
  }
}
