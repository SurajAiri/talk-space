// Ported from the GatherSpace template (pure canvas drawing, no engine dependency).
import type { Character } from '../types.ts'

export function drawCharacter(
  g: CanvasRenderingContext2D,
  char: Character,
  centerX: number,
  centerY: number,
  scale = 1,
  time = 0,
) {
  g.save();
  g.translate(centerX, centerY);
  g.scale(scale, scale);

  const isSitting = Boolean(char.sittingSeat);
  const bounce = char.dancing
    ? Math.abs(Math.sin(time * 0.015)) * -7
    : char.moving
    ? Math.abs(Math.sin(char.walkFrame * 0.35)) * -3
    : Math.sin(time * 0.003 + (char.id.length * 1.7)) * -1;

  const legSwing = char.moving ? Math.sin(char.walkFrame * 0.35) * 4 : 0;

  g.fillStyle = 'rgba(15, 23, 42, 0.35)';
  g.beginPath();
  g.ellipse(0, 14, 12, 5, 0, 0, Math.PI * 2);
  g.fill();

  if (char.isPlayer) {
    g.strokeStyle = 'rgba(52, 211, 153, 0.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, 14, 15, 6.5, 0, 0, Math.PI * 2);
    g.stroke();
  }

  g.translate(0, bounce);

  g.fillStyle = char.pants || '#1e293b';
  if (isSitting) {
    g.fillRect(-7, 5, 6, 6);
    g.fillRect(1, 5, 6, 6);
    g.fillStyle = '#0f172a';
    g.fillRect(-8, 9, 6, 3);
    g.fillRect(2, 9, 6, 3);
  } else {
    g.fillRect(-6, 4 + legSwing * 0.5, 5, 9);
    g.fillRect(1, 4 - legSwing * 0.5, 5, 9);
    g.fillStyle = '#0f172a';
    g.fillRect(-6, 11 + legSwing * 0.5, 5, 3);
    g.fillRect(1, 11 - legSwing * 0.5, 5, 3);
  }

  g.fillStyle = char.shirt;
  g.beginPath();
  g.roundRect(-9, -8, 18, 14, 4);
  g.fill();

  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fillRect(-4, -8, 8, 2);

  const armSwing = char.dancing ? Math.sin(time * 0.02) * 6 : char.moving ? -legSwing : 0;
  g.fillStyle = char.shirt;
  g.fillRect(-12, -6 + armSwing * 0.4, 4, 10);
  g.fillRect(8, -6 - armSwing * 0.4, 4, 10);
  g.fillStyle = char.skin;
  g.fillRect(-12, 2 + armSwing * 0.4, 4, 3);
  g.fillRect(8, 2 - armSwing * 0.4, 4, 3);

  g.fillStyle = char.skin;
  g.beginPath();
  g.roundRect(-10, -25, 20, 18, 6);
  g.fill();

  if (char.dir !== 'up') {
    const eyeOffsetX = char.dir === 'left' ? -2 : char.dir === 'right' ? 2 : 0;
    g.fillStyle = 'rgba(244, 63, 94, 0.28)';
    g.fillRect(-8 + eyeOffsetX, -14, 3, 2);
    g.fillRect(5 + eyeOffsetX, -14, 3, 2);

    g.fillStyle = '#0f172a';
    g.fillRect(-5 + eyeOffsetX, -17, 2.5, 3.5);
    g.fillRect(2.5 + eyeOffsetX, -17, 2.5, 3.5);

    g.fillStyle = '#ffffff';
    g.fillRect(-4.5 + eyeOffsetX, -17, 1, 1);
    g.fillRect(3 + eyeOffsetX, -17, 1, 1);

    g.fillStyle = '#7c2d12';
    g.fillRect(-2 + eyeOffsetX, -12, 4, 1.5);
  }

  g.fillStyle = char.hairColor;
  if (char.hairStyle === 'spiky') {
    g.beginPath();
    g.roundRect(-11, -28, 22, 8, 4);
    g.fill();
    g.fillRect(-11, -24, 3, 7);
    g.fillRect(8, -24, 3, 7);
  } else if (char.hairStyle === 'bob') {
    g.beginPath();
    g.roundRect(-11, -28, 22, 8, 5);
    g.fill();
    g.fillRect(-12, -24, 4, 13);
    g.fillRect(8, -24, 4, 13);
  } else if (char.hairStyle === 'long') {
    g.beginPath();
    g.roundRect(-11, -28, 22, 8, 5);
    g.fill();
    g.fillRect(-12, -24, 4, 18);
    g.fillRect(8, -24, 4, 18);
    if (char.dir === 'up') g.fillRect(-10, -22, 20, 16);
  } else if (char.hairStyle === 'curly') {
    g.beginPath();
    g.arc(0, -25, 12, 0, Math.PI * 2);
    g.arc(-9, -20, 6, 0, Math.PI * 2);
    g.arc(9, -20, 6, 0, Math.PI * 2);
    g.fill();
  } else if (char.hairStyle === 'bun') {
    g.beginPath();
    g.arc(0, -31, 5.5, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.roundRect(-11, -27, 22, 7, 4);
    g.fill();
  }

  if (char.accessory === 'glasses' && char.dir !== 'up') {
    const ox = char.dir === 'left' ? -2 : char.dir === 'right' ? 2 : 0;
    g.strokeStyle = '#38bdf8';
    g.lineWidth = 1.5;
    g.strokeRect(-7 + ox, -18, 5, 4.5);
    g.strokeRect(2 + ox, -18, 5, 4.5);
    g.beginPath();
    g.moveTo(-2 + ox, -16);
    g.lineTo(2 + ox, -16);
    g.stroke();
  } else if (char.accessory === 'headphones') {
    g.strokeStyle = '#f43f5e';
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(0, -19, 12, Math.PI, 0);
    g.stroke();
    g.fillStyle = '#f43f5e';
    g.fillRect(-13, -19, 3.5, 7);
    g.fillRect(9.5, -19, 3.5, 7);
  } else if (char.accessory === 'sunhat') {
    g.fillStyle = '#fcd34d';
    g.beginPath();
    g.ellipse(0, -26, 15, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f59e0b';
    g.beginPath();
    g.roundRect(-8, -32, 16, 6, 3);
    g.fill();
  } else if (char.accessory === 'crown') {
    const colors = ['#f472b6', '#facc15', '#60a5fa', '#f472b6'];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = colors[i];
      g.beginPath();
      g.arc(-7.5 + i * 5, -26, 2.8, 0, Math.PI * 2);
      g.fill();
    }
  }

  g.restore();
}

/**
 * How far to slide a speech bubble sideways so it stays inside the visible area. It never slides so
 * far that the tail (which points at the speaker, at x = 0) would leave the bubble.
 * `visible` is relative to the speaker, in world units; the bubble is drawn at `scale`.
 */
export function bubbleShift(width: number, scale: number, visible?: { minX: number; maxX: number }): number {
  if (!visible) return 0;
  const lo = visible.minX / scale + 8;
  const hi = visible.maxX / scale - 8;
  let shift = 0;
  if (-width / 2 < lo) shift = lo + width / 2;
  else if (width / 2 > hi) shift = hi - width / 2;
  const limit = Math.max(0, width / 2 - 18);
  return Math.max(-limit, Math.min(limit, shift));
}

/** A bubble belongs to a person you can see: if they are off screen it would only be a clipped fragment at the edge. */
export function bubbleVisible(visible?: { minX: number; maxX: number }): boolean {
  return !visible || (visible.minX < -6 && visible.maxX > 6);
}

const UI_FONT = "'Instrument Sans Variable', Inter, system-ui, sans-serif"

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** Overshoots a little before settling: the bubble "pops" into place. */
const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Greedy word wrap into at most `maxLines` lines, ending the last one with an ellipsis if text is left over. */
function wrapLines(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  const fits = (t: string) => g.measureText(t).width <= maxW
  for (let word of words) {
    // a single very long word (a URL, keyboard mash) is cut to fit rather than overflowing the bubble
    while (!fits(word) && word.length > 1) {
      let n = word.length - 1
      while (n > 1 && !fits(word.slice(0, n))) n--
      if (line) {
        lines.push(line)
        line = ''
      }
      lines.push(word.slice(0, n))
      word = word.slice(n)
    }
    const next = line ? `${line} ${word}` : word
    if (fits(next)) line = next
    else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]!
  while (last.length > 1 && !fits(last + '…')) last = last.slice(0, -1)
  kept[maxLines - 1] = last.trimEnd() + '…'
  return kept
}

/**
 * Name tag, speech bubble and reaction above a person. `scale` grows them when the camera is zoomed
 * out (a phone shows the whole room small) so the text stays readable.
 */
export function drawCharacterOverlays(
  g: CanvasRenderingContext2D,
  char: Character,
  time: number,
  scale = 1,
  /** the part of the screen that is visible, as x offsets from this person (world units) */
  visible?: { minX: number; maxX: number },
) {
  g.save();
  g.translate(char.x, char.y);
  g.scale(scale, scale);

  const tagText = char.name + (char.flair ? ' ' + char.flair : '');
  g.font = `600 12px ${UI_FONT}`;
  const textWidth = g.measureText(tagText).width;
  const pillW = textWidth + 26;
  const pillH = 22;
  const pillX = -pillW / 2;
  const pillY = -52;

  g.fillStyle = 'rgba(12, 18, 38, 0.9)';
  g.beginPath();
  g.roundRect(pillX, pillY, pillW, pillH, 999);
  g.fill();
  g.strokeStyle = char.isPlayer ? 'rgba(52, 211, 153, 0.75)' : 'rgba(255, 255, 255, 0.18)';
  g.lineWidth = 1;
  g.stroke();

  if (char.status === 'vibing') {
    g.font = '10px sans-serif';
    g.fillText('🎧', pillX + 5, pillY + 14.5);
  } else {
    g.fillStyle = char.status === 'busy' ? '#fbbf24' : '#34d399';
    g.beginPath();
    g.arc(pillX + 11, pillY + pillH / 2, 3.6, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#f8fafc';
  g.font = `600 12px ${UI_FONT}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(tagText, pillX + 20, pillY + pillH / 2 + 0.5);

  let topOffset = pillY - 8;
  const b = char.speechBubble;
  if (b && b.timer > 0 && bubbleVisible(visible)) {
    const pop = easeOutBack(clamp01(b.age / 200));
    const fade = clamp01(b.timer / 400);
    const rise = (1 - fade) * 8;

    g.save();
    g.globalAlpha *= fade;
    g.font = `500 13.5px ${UI_FONT}`;
    const lines = wrapLines(g, b.text, 200, 3);
    const lineH = 18;
    const padX = 12;
    const padY = 8;
    const labelH = b.dm ? 15 : 0;
    const widest = Math.max(...lines.map((l) => g.measureText(l).width), b.dm ? 44 : 0);
    const w = Math.max(40, widest + padX * 2);
    const h = lines.length * lineH + padY * 2 + labelH;
    const tail = 7;
    const by = topOffset - tail - h;
    // keep the whole bubble on screen; the tail still points at the speaker
    const shift = bubbleShift(w, scale, visible);

    // grow out of the tail tip, so it reads as coming from the person
    g.translate(0, topOffset - rise);
    g.scale(pop, pop);
    g.translate(0, -topOffset);

    g.shadowColor = 'rgba(8, 12, 30, 0.35)';
    g.shadowBlur = 12;
    g.shadowOffsetY = 3;
    g.fillStyle = b.dm ? '#3454f0' : '#ffffff';
    g.beginPath();
    g.roundRect(-w / 2 + shift, by, w, h, 14);
    g.moveTo(-7, by + h - 0.5);
    g.lineTo(7, by + h - 0.5);
    g.lineTo(0, by + h + tail);
    g.closePath();
    g.fill();
    g.shadowColor = 'transparent';

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let ty = by + padY;
    if (b.dm) {
      g.font = `600 10.5px ${UI_FONT}`;
      g.fillStyle = 'rgba(255, 255, 255, 0.78)';
      g.fillText('Private', shift, ty + 7);
      ty += labelH;
    }
    g.font = `500 13.5px ${UI_FONT}`;
    g.fillStyle = b.dm ? '#ffffff' : '#0f172a';
    for (const line of lines) {
      g.fillText(line, shift, ty + lineH / 2);
      ty += lineH;
    }
    g.restore();
    topOffset = by - 8;
  }

  if (char.reaction && char.reaction.timer > 0) {
    const r = char.reaction;
    r.scale = Math.min(1, r.scale + 0.12);
    const bob = Math.sin(time * 0.01) * 3;
    g.save();
    g.translate(0, topOffset - 18 + bob);
    g.scale(r.scale, r.scale);

    g.fillStyle = 'rgba(255, 255, 255, 0.96)';
    g.beginPath();
    g.arc(0, 0, 16, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#10b981';
    g.lineWidth = 2;
    g.stroke();

    g.font = '18px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(r.emoji, 0, 1);
    g.restore();
  }

  g.restore();
}
