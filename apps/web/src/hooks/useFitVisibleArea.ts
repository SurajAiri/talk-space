import { useLayoutEffect, type RefObject } from 'react'

const isTextField = (el: Element | null) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement

/**
 * Keeps a full-screen, `position: fixed; inset: 0` element exactly on what the person can see.
 *
 * Normally the layout viewport and the visible area are the same thing and this does nothing. They drift apart on
 * phones: "Desktop site" mode, a leftover pan/zoom, or the on-screen keyboard from the previous screen (typing the
 * room title) closing late. Then `inset: 0` is measured against a stale, shorter or shifted box: the map is drawn in
 * only part of the screen, and the bar and buttons pinned to its edges end up outside what is visible.
 * When that happens we size the element from `window.visualViewport` (what is actually on screen) instead.
 *
 * Skipped while a text field has focus: then the keyboard is up and the page should behave as it always did.
 */
export function useFitVisibleArea(ref: RefObject<HTMLElement | null>, mounted = true) {
  useLayoutEffect(() => {
    const el = ref.current
    const vv = window.visualViewport
    if (!el || !mounted) return

    // A previous screen (the create-room form) may have left the page scrolled or panned.
    window.scrollTo(0, 0)
    if (!vv) return

    let raf = 0
    let settle: ReturnType<typeof setTimeout> | undefined

    const release = () => {
      for (const prop of ['top', 'left', 'right', 'bottom', 'width', 'height']) el.style.removeProperty(prop)
    }

    const apply = () => {
      raf = 0
      if (isTextField(document.activeElement)) return release()
      const drifted =
        Math.abs(vv.width - window.innerWidth) > 2 ||
        Math.abs(vv.height - window.innerHeight) > 2 ||
        Math.abs(vv.offsetLeft) > 1 ||
        Math.abs(vv.offsetTop) > 1
      if (!drifted) return release()
      el.style.top = `${vv.offsetTop}px`
      el.style.left = `${vv.offsetLeft}px`
      el.style.width = `${vv.width}px`
      el.style.height = `${vv.height}px`
      el.style.right = 'auto'
      el.style.bottom = 'auto'
    }

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply)
      // keyboards and browser bars animate: look again once they have finished
      clearTimeout(settle)
      settle = setTimeout(apply, 350)
    }

    schedule()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    document.addEventListener('focusout', schedule)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      document.removeEventListener('focusout', schedule)
      release()
    }
  }, [ref, mounted])
}
