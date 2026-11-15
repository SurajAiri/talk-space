import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clampZoom, fitZoom, MAX_VISIBLE_TILES, MAX_ZOOM, wheelZoomFactor, zoomLimits } from '../src/world/camera.ts'
import { TILE } from '../src/world/types.ts'

const tilesSeen = (w: number, h: number, zoom: number) => (w / zoom / TILE) * (h / zoom / TILE)

test('zoom-out is limited by how much you can see, so a laptop can no longer show the whole map', () => {
  // the Sky Night Market is 48 x 36 tiles; a 1440 x 800 laptop used to be able to zoom out to 0.5 and see all of it
  const { min } = zoomLimits(1440, 800, 48, 36)
  const view = { w: 1440 / min / TILE, h: 800 / min / TILE }
  assert.ok(view.w < 48 * 0.7 && view.h < 36 * 0.6, `still sees ${view.w.toFixed(1)} x ${view.h.toFixed(1)} tiles`)
  assert.ok(tilesSeen(1440, 800, min) <= MAX_VISIBLE_TILES + 1)
})

test('the same rule holds on a big monitor, a phone and an ultrawide', () => {
  for (const [w, h] of [[1920, 1080], [2560, 1440], [390, 800], [800, 390], [3440, 1440]] as const) {
    const l = zoomLimits(w, h, 48, 36)
    assert.ok(l.min >= 0.4 && l.min <= MAX_ZOOM, `${w}x${h}: min ${l.min}`)
    assert.ok(l.max >= l.min, `${w}x${h}: max below min`)
    if (l.min < MAX_ZOOM) assert.ok(tilesSeen(w, h, l.min) <= MAX_VISIBLE_TILES + 1, `${w}x${h} sees too much`)
  }
})

test('zoom-in has a ceiling too', () => {
  const l = zoomLimits(1440, 800, 48, 36)
  assert.equal(clampZoom(10, l), l.max)
  assert.equal(l.max, MAX_ZOOM)
  assert.equal(clampZoom(0.01, l), l.min)
})

test('the starting view always sits inside the limits', () => {
  for (const [w, h] of [[1440, 800], [1920, 1080], [390, 800], [3440, 1440], [320, 480]] as const) {
    const l = zoomLimits(w, h, 48, 36)
    const z = fitZoom(w, h, l)
    assert.ok(z >= l.min && z <= l.max, `${w}x${h}: ${z} outside ${l.min}..${l.max}`)
  }
})

test('zooming out never goes past the point where the whole map just fits (that only adds empty space)', () => {
  // a tiny 12 x 10 map on a big screen: the map fills the window at "contain", so that is the floor
  const l = zoomLimits(1440, 800, 12, 10)
  assert.ok(Math.abs(l.min - Math.min(1440 / (12 * TILE), 800 / (10 * TILE))) < 1e-9 || l.min === MAX_ZOOM)
})

test('the wheel is proportional: a trackpad pinch eases, a mouse notch steps', () => {
  assert.ok(wheelZoomFactor(-100) > 1 && wheelZoomFactor(100) < 1)
  const pinch = wheelZoomFactor(-3)
  assert.ok(pinch > 1 && pinch < 1.01, `one pinch event changed the zoom by ${pinch}`)
  // 30 tiny events add up to about one notch, instead of 30 fixed 10% jumps
  assert.ok(Math.abs(wheelZoomFactor(-3) ** 30 - wheelZoomFactor(-90)) < 1e-9)
  assert.ok(wheelZoomFactor(-1e6) <= wheelZoomFactor(-120) + 1e-12, 'one huge event is capped')
  assert.equal(wheelZoomFactor(0), 1)
  assert.equal(wheelZoomFactor(-3, 1), wheelZoomFactor(-48, 0), 'line-mode wheels are scaled to pixels')
})
