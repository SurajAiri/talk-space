import type { Reaction } from '../types.ts'

const FONT = "'Instrument Sans Variable', Inter, system-ui, sans-serif"
const EMOJI_FONT = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif"
const TAU = Math.PI * 2

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** A cheap deterministic 0..1 from two numbers, so every viewer sees the same burst without sending any of it. */
const rand = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * A reaction above someone's head. `topOffset` is the y (relative to the person) it should sit above, so it
 * stacks over the name tag and any speech bubble. Everything is a function of `r.age`, so it needs no state.
 */
export function drawReaction(g: CanvasRenderingContext2D, r: Reaction, topOffset: number, time: number) {
  const fade = clamp01(r.timer / 450)
  if (fade <= 0) return
  g.save()
  g.globalAlpha *= fade
  if (r.kind === 'emoji') drawEmojiBurst(g, r, topOffset)
  else drawWord(g, r, topOffset, time)
  g.restore()
}

function drawEmojiBurst(g: CanvasRenderingContext2D, r: Reaction, topOffset: number) {
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  // little ones float up and out, each on its own schedule
  for (let i = 0; i < 8; i++) {
    const start = rand(i, 1) * 700
    const p = clamp01((r.age - start) / 1700)
    if (p <= 0 || p >= 1) continue
    const x = (rand(i, 2) - 0.5) * 56 + Math.sin(p * 6 + i) * 6
    const y = topOffset - 20 - p * (46 + rand(i, 3) * 26)
    g.globalAlpha *= 1 - p * p * 0.85
    g.font = `${12 + Math.round(rand(i, 4) * 8)}px ${EMOJI_FONT}`
    g.fillText(r.text, x, y)
    g.globalAlpha /= 1 - p * p * 0.85
  }
  // the big one pops in, then bobs
  const pop = easeOutBack(clamp01(r.age / 260))
  const bob = Math.sin(r.age * 0.008) * 2.5
  g.save()
  g.translate(0, topOffset - 26 + bob)
  g.scale(pop, pop)
  g.fillStyle = 'rgba(255, 255, 255, 0.94)'
  g.beginPath()
  g.arc(0, 0, 20, 0, TAU)
  g.fill()
  g.strokeStyle = '#10b981'
  g.lineWidth = 2.5
  g.stroke()
  g.font = `24px ${EMOJI_FONT}`
  g.fillStyle = '#000'
  g.fillText(r.text, 0, 1.5)
  g.restore()
}

/** Big stroked letters, animated per style. Letters are placed one by one so they can move on their own. */
function drawWord(g: CanvasRenderingContext2D, r: Reaction, topOffset: number, time: number) {
  const size = 26
  g.font = `900 ${size}px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  const letters = [...r.text]
  const widths = letters.map((ch) => g.measureText(ch).width + 1)
  const total = widths.reduce((a, b) => a + b, 0)

  const intro = easeOutBack(clamp01(r.age / 320))
  const rise = -Math.min(18, r.age * 0.012)
  const baseY = topOffset - 28 + rise

  g.save()
  g.translate(0, baseY)
  if (r.style === 'shake') g.translate(Math.sin(time * 0.09) * 2.4, Math.cos(time * 0.11) * 1.4)
  g.scale(intro, intro)

  let x = -total / 2
  letters.forEach((ch, i) => {
    const w = widths[i]!
    let dy = 0
    let color = r.color
    let scale = 1
    switch (r.style) {
      case 'wave':
        dy = Math.sin(time * 0.008 + i * 0.7) * 5
        break
      case 'bounce': {
        const t = ((time * 0.005 - i * 0.35) % 3) / 3
        dy = t >= 0 && t < 0.35 ? -Math.sin((t / 0.35) * Math.PI) * 9 : 0
        break
      }
      case 'rainbow':
        color = `hsl(${(time * 0.25 + i * 55) % 360}, 92%, 62%)`
        dy = Math.sin(time * 0.006 + i) * 2
        break
      case 'glow':
        scale = 1 + Math.sin(time * 0.008) * 0.05
        break
      case 'pop':
        scale = 1 + Math.sin(time * 0.007 + i * 0.5) * 0.05
        break
    }
    g.save()
    g.translate(x + w / 2, dy)
    g.scale(scale, scale)
    if (r.style === 'glow') {
      g.shadowColor = color
      g.shadowBlur = 14 + Math.sin(time * 0.008) * 6
    }
    g.lineWidth = 6
    g.strokeStyle = '#0b1125'
    g.strokeText(ch, 0, 0)
    g.shadowBlur = 0
    g.shadowColor = 'transparent'
    g.fillStyle = color
    g.fillText(ch, 0, 0)
    // a bright top edge so the letters read as chunky stickers
    g.fillStyle = 'rgba(255, 255, 255, 0.28)'
    g.save()
    g.beginPath()
    g.rect(-w, -size / 2, w * 2, size * 0.34)
    g.clip()
    g.fillText(ch, 0, 0)
    g.restore()
    g.restore()
    x += w
  })
  g.restore()
}
