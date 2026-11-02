/**
 * Draws the link-preview picture (public/og-image.jpg, 1200 x 630) that WhatsApp, iMessage, Telegram,
 * Slack, Discord, X, Facebook and LinkedIn show when somebody pastes the site's link.
 *
 *   pnpm --filter web og
 *
 * It is painted with the game's own tile, prop and character art, and the percentages come from the real
 * `hearingGain` rule, so the picture shows the product as it is. Re-run it after changing the art, the brand
 * colours or the wording below, and commit the new image.
 *
 * Plain Node (>= 22.18, type stripping) plus @napi-rs/canvas; no browser and no build step.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, GlobalFonts, type Canvas, type SKRSContext2D } from '@napi-rs/canvas'
import { appearanceFor } from '../src/world/appearance.ts'
import { HEARING, hearingGain } from '../src/world/hearing.ts'
import { drawCharacter, drawCharacterOverlays } from '../src/world/render/character.ts'
import { drawPropItem, drawWorldTiles } from '../src/world/render/scene.ts'
import { buildWorldMap, parseMapFile } from '../src/world/format/mapFile.ts'
import { TILE, type Character, type Dir } from '../src/world/types.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public', 'og-image.jpg')

// ---------- what the picture says (edit here) ----------------------------------------------------------------

const HEADLINE = ['Walk over', 'to a', 'conversation.']
const SUBLINE = ['Voice rooms you can walk around in.', 'The closer you stand, the clearer you hear.']
const CHIPS = ['Up to 8 per room', 'Works on phones']
const MAP_KEY = 'beach'

// ---------- brand (same values as landing.css) ----------------------------------------------------------------

const INK = '#0e1220'
const INK_2 = '#3d4558'
const SKY = '#d7ebfa'
const COBALT = '#3454f0'
const TAU = Math.PI * 2

const W = 1200
const H = 630
const MARGIN = 56
/** WhatsApp quietly drops preview pictures much above ~300 KB, and the sender's phone has to download it on a slow connection: stay far below that. */
const MAX_BYTES = 90 * 1024

// ---------- plumbing --------------------------------------------------------------------------------------------

/** The game's art code draws through the browser's CanvasRenderingContext2D; napi's context speaks the same dialect. */
const dom = (g: SKRSContext2D) => g as unknown as CanvasRenderingContext2D

// The tile art bakes its textures into OffscreenCanvas bitmaps when it can (same look as in the browser).
// `new` on a function that returns an object gives back that object, so this hands out napi canvases.
;(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = function (w: number, h: number) {
  return createCanvas(w, h)
}

const fontDir = (pkg: string, file: string) => path.join(ROOT, 'node_modules', '@fontsource-variable', pkg, 'files', file)
GlobalFonts.registerFromPath(fontDir('bricolage-grotesque', 'bricolage-grotesque-latin-wght-normal.woff2'), 'Bricolage Grotesque Variable')
GlobalFonts.registerFromPath(fontDir('instrument-sans', 'instrument-sans-latin-wght-normal.woff2'), 'Instrument Sans Variable')
const DISPLAY = "'Bricolage Grotesque Variable'"
const UI = "'Instrument Sans Variable'"

function pill(g: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

// ---------- the scene: a slice of the real beach map -----------------------------------------------------------

interface Actor {
  id: string
  name: string
  /** tile units, like the network messages */
  x: number
  y: number
  dir: Dir
  you?: boolean
  dancing?: boolean
  say?: string
}

/** Everyone stands in the open (no audio zone), so the rule is plain distance: closer = louder. */
const CAST: Actor[] = [
  { id: 'you', name: 'You', x: 23.0, y: 18.4, dir: 'down', you: true },
  { id: 'hana', name: 'Hana', x: 21.5, y: 19.3, dir: 'right' },
  { id: 'priya', name: 'Priya', x: 25.1, y: 21.3, dir: 'left', say: 'Can you hear me?' },
  { id: 'diego', name: 'Diego', x: 23.2, y: 23.4, dir: 'down', dancing: true },
]
const CAMERA = { x: 23.5, y: 20.4, zoom: 1.2 }
const TIME = 1500 // ms into the tiles' animation (water glints, flames)

function renderScene(w: number, h: number): Canvas {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/world/maps/data', `${MAP_KEY}.map.json`), 'utf8'))
  const { map: file } = parseMapFile(raw)
  if (!file) throw new Error(`map "${MAP_KEY}" is invalid`)
  const map = buildWorldMap(file)

  const canvas = createCanvas(w, h)
  const g = canvas.getContext('2d')
  const d = dom(g)
  const { zoom } = CAMERA
  const camX = CAMERA.x * TILE
  const camY = CAMERA.y * TILE

  g.fillStyle = '#0f172a'
  g.fillRect(0, 0, w, h)
  g.translate(w / 2 - camX * zoom, h / 2 - camY * zoom)
  g.scale(zoom, zoom)

  const viewW = w / zoom
  const viewH = h / zoom
  drawWorldTiles(
    d,
    map.grid,
    Math.max(0, Math.floor((camX - viewW / 2) / TILE) - 1),
    Math.min(map.cols - 1, Math.ceil((camX + viewW / 2) / TILE) + 1),
    Math.max(0, Math.floor((camY - viewH / 2) / TILE) - 1),
    Math.min(map.rows - 1, Math.ceil((camY + viewH / 2) / TILE) + 1),
    TIME,
  )

  // the same numbers the game uses
  const me = CAST.find((a) => a.you)!
  const gainOf = (a: Actor) => hearingGain(map, me, a)
  const fadeOf = (a: Actor) => (a.you ? 1 : 0.55 + 0.45 * gainOf(a)) // the farther away, the fainter
  // keep speech bubbles inside the picture, like the game does at the edge of a screen
  const visibleFor = (c: Character) => ({ minX: camX - viewW / 2 - c.x, maxX: camX + viewW / 2 - c.x })

  // how far "You" can be heard: solid = full volume, dashed = fades to nothing (the logo, drawn on the ground)
  const mx = me.x * TILE
  const my = me.y * TILE
  g.beginPath()
  g.arc(mx, my, HEARING.fullRadius * TILE, 0, TAU)
  g.fillStyle = 'rgba(255, 255, 255, 0.3)'
  g.fill()
  g.strokeStyle = COBALT
  g.lineWidth = 7
  g.stroke()
  g.strokeStyle = '#fff'
  g.lineWidth = 3
  g.stroke()
  g.beginPath()
  g.arc(mx, my, HEARING.maxRadius * TILE, 0, TAU)
  g.setLineDash([14, 12])
  g.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  g.lineWidth = 3
  g.stroke()
  g.setLineDash([])

  // people (faded when out of earshot, like in a room) and props share one depth-sorted pass
  const people: { actor: Actor; ch: Character }[] = CAST.map((a) => ({
    actor: a,
    ch: {
      id: a.id,
      name: a.name,
      flair: '',
      status: 'available',
      isPlayer: Boolean(a.you),
      x: a.x * TILE,
      y: a.y * TILE,
      dir: a.dir,
      moving: false,
      walkFrame: 0,
      dancing: Boolean(a.dancing),
      sittingSeat: null,
      ...appearanceFor(a.id),
      speechBubble: a.say ? { text: a.say, dm: false, age: 1000, timer: 5000 } : null,
      reaction: null,
    },
  }))
  const items: { sortY: number; draw: () => void }[] = []
  for (const p of map.props) items.push({ sortY: (p.row + p.h) * TILE - (p.type === 'seat' ? 16 : 0), draw: () => drawPropItem(d, p, TIME) })
  for (const { actor, ch } of people) {
    items.push({
      sortY: ch.y + 12,
      draw: () => {
        g.globalAlpha = fadeOf(actor)
        drawCharacter(d, ch, ch.x, ch.y, 1, TIME)
        g.globalAlpha = 1
      },
    })
  }
  items.sort((a, b) => a.sortY - b.sortY)
  for (const it of items) it.draw()

  // name tags, speech bubbles and the "how well do I hear them" chips, a little larger so they survive a small thumbnail
  const os = 1.3
  for (const { actor, ch } of people) {
    g.globalAlpha = fadeOf(actor)
    drawCharacterOverlays(d, ch, TIME, os, visibleFor(ch))
    g.globalAlpha = 1
    if (actor.you) continue
    const gain = gainOf(actor)
    const audible = gain > 0.005
    const label = audible ? `${Math.round(gain * 100)}%` : 'out of earshot'
    g.save()
    g.translate(ch.x, ch.y + 30 * os)
    g.scale(os, os)
    g.font = `700 11px ${UI}`
    const lw = g.measureText(label).width + 16
    g.fillStyle = 'rgba(255, 255, 255, 0.95)'
    pill(g, -lw / 2, -9, lw, 18, 9)
    g.fill()
    g.fillStyle = audible ? '#0b7a53' : '#5b6479'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(label, 0, 0.5)
    g.restore()
  }
  return canvas
}

// ---------- the card -----------------------------------------------------------------------------------------------

function drawBackground(g: SKRSContext2D) {
  g.fillStyle = SKY
  g.fillRect(0, 0, W, H)
  // the landing page's big checkerboard
  const cell = 96
  g.fillStyle = 'rgba(255, 255, 255, 0.45)'
  for (let r = 0; r * cell < H; r++) for (let c = 0; c * cell < W; c++) if ((r + c) % 2 === 0) g.fillRect(c * cell, r * cell, cell, cell)
}

/** The logo: a voice (dot), where it is heard clearly (solid ring), where it fades out (dashed ring). */
function drawLogoMark(g: SKRSContext2D, x: number, y: number, size: number) {
  g.save()
  g.translate(x, y)
  g.scale(size / 32, size / 32)
  g.fillStyle = COBALT
  pill(g, 0, 0, 32, 32, 9)
  g.fill()
  g.fillStyle = '#fff'
  g.beginPath()
  g.arc(16, 16, 3.4, 0, TAU)
  g.fill()
  g.strokeStyle = '#fff'
  g.lineWidth = 2.2
  g.beginPath()
  g.arc(16, 16, 8, 0, TAU)
  g.stroke()
  g.strokeStyle = 'rgba(255, 255, 255, 0.6)'
  g.lineWidth = 2
  g.lineCap = 'round'
  g.setLineDash([1.2, 4.4])
  g.beginPath()
  g.arc(16, 16, 12.6, 0, TAU)
  g.stroke()
  g.restore()
}

/** A framed picture with the landing page's hard ink shadow. */
function drawFrame(g: SKRSContext2D, picture: Canvas, x: number, y: number, w: number, h: number) {
  const radius = 24
  g.fillStyle = INK
  pill(g, x + 14, y + 14, w, h, radius)
  g.fill()
  g.save()
  pill(g, x, y, w, h, radius)
  g.clip()
  g.drawImage(picture, x, y)
  g.restore()
  g.strokeStyle = INK
  g.lineWidth = 5
  pill(g, x + 2.5, y + 2.5, w - 5, h - 5, radius - 2)
  g.stroke()
}

function drawChip(g: SKRSContext2D, text: string, x: number, y: number): number {
  g.font = `650 24px ${UI}`
  const w = g.measureText(text).width + 40
  const h = 48
  g.fillStyle = INK
  pill(g, x + 4, y + 4, w, h, 14)
  g.fill()
  g.fillStyle = '#fff'
  pill(g, x, y, w, h, 14)
  g.fill()
  g.strokeStyle = INK
  g.lineWidth = 3
  pill(g, x + 1.5, y + 1.5, w - 3, h - 3, 13)
  g.stroke()
  g.fillStyle = INK
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText(text, x + 20, y + h / 2 + 1)
  return w
}

function drawCard(): Canvas {
  const canvas = createCanvas(W, H)
  const g = canvas.getContext('2d')
  drawBackground(g)

  // brand row
  drawLogoMark(g, MARGIN, MARGIN - 4, 52)
  g.fillStyle = INK
  g.font = `750 40px ${DISPLAY}`
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.letterSpacing = '-0.8px'
  g.fillText('Talk Space', MARGIN + 68, MARGIN + 22)

  // the right-hand picture first, so we know how much room the words have
  const frame = { x: 640, y: MARGIN, w: W - MARGIN - 14 - 640, h: H - MARGIN * 2 - 14 }
  drawFrame(g, renderScene(frame.w, frame.h), frame.x, frame.y, frame.w, frame.h)

  // headline: as big as fits in the left column
  const columnW = frame.x - MARGIN - 36
  let size = 96
  g.textBaseline = 'alphabetic'
  for (; size > 60; size -= 2) {
    g.font = `800 ${size}px ${DISPLAY}`
    g.letterSpacing = `${(-0.035 * size).toFixed(1)}px`
    if (Math.max(...HEADLINE.map((l) => g.measureText(l).width)) <= columnW) break
  }
  const lead = size * 0.95
  let baseline = 204
  g.fillStyle = INK
  for (const line of HEADLINE) {
    g.fillText(line, MARGIN - 4, baseline)
    baseline += lead
  }
  // the landing page's blue rule under the last word
  const lastW = g.measureText(HEADLINE[HEADLINE.length - 1]!).width
  g.fillStyle = COBALT
  g.fillRect(MARGIN - 2, baseline - lead + size * 0.16, lastW - 10, Math.round(size * 0.1))

  // one sentence of what it is
  g.letterSpacing = '0px'
  g.font = `500 27px ${UI}`
  g.fillStyle = INK_2
  let sy = baseline - lead + size * 0.16 + 58
  for (const line of SUBLINE) {
    g.fillText(line, MARGIN, sy)
    sy += 37
  }

  // chips
  let cx = MARGIN
  for (const chip of CHIPS) cx += drawChip(g, chip, cx, H - MARGIN - 14 - 48) + 16
  return canvas
}

// ---------- write it -------------------------------------------------------------------------------------------------

const card = drawCard()
let quality = 92
let jpeg = card.toBuffer('image/jpeg', quality)
while (jpeg.length > MAX_BYTES && quality > 60) {
  quality -= 4
  jpeg = card.toBuffer('image/jpeg', quality)
}
fs.writeFileSync(OUT, jpeg)
console.log(`${path.relative(process.cwd(), OUT)}: ${W}x${H}, ${(jpeg.length / 1024).toFixed(0)} KB (jpeg quality ${quality})`)
if (jpeg.length > MAX_BYTES) console.warn('warning: still larger than the 90 KB budget; simplify the scene')
