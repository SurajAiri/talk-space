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

export function drawCharacterOverlays(g: CanvasRenderingContext2D, char: Character, time: number) {
  g.save();
  g.translate(char.x, char.y);

  const tagText = char.name + (char.flair ? ' ' + char.flair : '');
  g.font = '600 11px Inter, sans-serif';
  const textWidth = g.measureText(tagText).width;
  const pillW = textWidth + 24;
  const pillH = 20;
  const pillX = -pillW / 2;
  const pillY = -49;

  g.fillStyle = 'rgba(15, 23, 42, 0.88)';
  g.beginPath();
  g.roundRect(pillX, pillY, pillW, pillH, 999);
  g.fill();
  g.strokeStyle = char.isPlayer ? 'rgba(52, 211, 153, 0.7)' : 'rgba(255, 255, 255, 0.15)';
  g.lineWidth = 1;
  g.stroke();

  if (char.status === 'vibing') {
    g.font = '10px sans-serif';
    g.fillText('🎧', pillX + 5, pillY + 13.5);
  } else {
    g.fillStyle = char.status === 'busy' ? '#fbbf24' : '#34d399';
    g.beginPath();
    g.arc(pillX + 10, pillY + pillH / 2, 3.5, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#f8fafc';
  g.font = '600 11px Inter, sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(tagText, pillX + 18, pillY + pillH / 2 + 0.5);

  let topOffset = pillY - 6;
  if (char.speechBubble && char.speechBubble.timer > 0) {
    const msg = char.speechBubble.text;
    g.font = '500 11px Inter, sans-serif';
    const bw = Math.min(220, g.measureText(msg).width + 20);
    const bh = 24;
    const bx = -bw / 2;
    const by = topOffset - bh;

    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(bx, by, bw, bh, 10);
    g.fill();
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = 1.5;
    g.stroke();

    g.beginPath();
    g.moveTo(-4, by + bh);
    g.lineTo(4, by + bh);
    g.lineTo(0, by + bh + 5);
    g.closePath();
    g.fill();

    g.fillStyle = '#0f172a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const clipped = msg.length > 30 ? msg.slice(0, 29) + '…' : msg;
    g.fillText(clipped, 0, by + bh / 2);
    topOffset = by - 6;
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
