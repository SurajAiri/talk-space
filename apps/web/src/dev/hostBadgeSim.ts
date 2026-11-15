/**
 * DEV ONLY: a stand-in for the badge Netlify's free plan injects into every page, so layouts can be
 * checked while developing instead of only after a deploy. Turn it on with VITE_DEV_HOST_BADGE=true in
 * apps/web/.env (restart `pnpm dev`). Production bundles do not contain this file (see main.tsx).
 *
 * What is the real thing, according to Netlify's docs and to several independent bug reports:
 * an <iframe id="nl-badge-frame"> that Netlify's edge script (/.netlify/scripts/hud) adds to the page,
 * position: fixed at the bottom-right, z-index 2147483645. Being an iframe it swallows every tap over its
 * whole box, transparent margin included, so anything under it cannot be pressed. This copy uses the
 * same id, position and z-index, and is an iframe too, so page CSS cannot reach it, as with the real one.
 *
 * What is NOT verified: its size. Reports of the real one say about 194-197 x 64 px on a 390px phone
 * (one says 216 x 92). The defaults below are the former; measure YOUR live site with the snippet in
 * .env.example and put the numbers in .env. The little pill drawn inside is only approximate artwork.
 * Tapping the real badge also opens a card; that is not simulated.
 */

type Env = Record<string, string | undefined>

const num = (v: string | undefined, fallback: number) => {
  const n = v === undefined || v.trim() === '' ? NaN : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export const BADGE_FRAME_ID = 'nl-badge-frame'

export function mountHostBadgeSim(env: Env = import.meta.env as Env): void {
  if (document.getElementById(BADGE_FRAME_ID)) return

  const width = num(env.VITE_DEV_HOST_BADGE_WIDTH, 197)
  const height = num(env.VITE_DEV_HOST_BADGE_HEIGHT, 64)
  const right = num(env.VITE_DEV_HOST_BADGE_RIGHT, 0)
  const bottom = num(env.VITE_DEV_HOST_BADGE_BOTTOM, 0)
  const outline = env.VITE_DEV_HOST_BADGE_OUTLINE === 'true'

  const frame = document.createElement('iframe')
  frame.id = BADGE_FRAME_ID
  frame.title = 'Powered by Netlify (dev stand-in)'
  frame.srcdoc =
    '<!doctype html><meta charset="utf-8"><style>' +
    'html,body{margin:0;height:100%;background:transparent}' +
    'body{display:flex;align-items:center;justify-content:center;font:600 13px/1 system-ui,sans-serif}' +
    '.pill{padding:12px 18px;border-radius:999px;background:#fff;color:#0e1e25;white-space:nowrap;' +
    'box-shadow:0 2px 10px rgb(0 0 0/.25)}' +
    '</style><div class="pill">Powered by Netlify</div>'
  frame.style.cssText =
    `position:fixed;right:${right}px;bottom:${bottom}px;width:${width}px;height:${height}px;` +
    'border:0;background:transparent;z-index:2147483645;color-scheme:normal;' +
    (outline ? 'outline:1px dashed rgb(255 0 80/.8);outline-offset:-1px;' : '')
  document.body.appendChild(frame)

  // Does the room the layout leaves clear (--host-badge in index.css) cover this badge?
  const reserved = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--host-badge'))
  const needed = height + bottom
  console.info(
    `[host-badge sim] ${width}x${height}px, ${right}px from the right, ${bottom}px from the bottom.`,
    Number.isFinite(reserved) && reserved < needed
      ? `WARNING: --host-badge is ${reserved}px but this badge needs ${needed}px, so it will overlap.`
      : `--host-badge (${reserved}px) covers it.`,
  )
}
