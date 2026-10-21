// Ported from the GatherSpace template.
import { TILE, type Prop } from '../types'

export function drawPropItem(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE;
  const y = p.row * TILE;

  if (p.type === 'fountain') {
    const cx = x + TILE;
    const cy = y + TILE;
    g.fillStyle = '#64748b';
    g.beginPath();
    g.arc(cx, cy, 42, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#38bdf8';
    g.beginPath();
    g.arc(cx, cy, 34, 0, Math.PI * 2);
    g.fill();
    const r1 = 12 + ((time * 0.02) % 20);
    g.strokeStyle = 'rgba(255,255,255,0.65)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, r1, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#e2e8f0';
    g.beginPath();
    g.arc(cx, cy, 10, 0, Math.PI * 2);
    g.fill();
  } else if (p.type === 'tree') {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    const sway = Math.sin(time * 0.0025 + p.col) * 2;
    g.fillStyle = 'rgba(15, 23, 42, 0.28)';
    g.beginPath();
    g.ellipse(cx, cy + 16, 22, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#78350f';
    g.fillRect(cx - 6, cy - 4, 12, 20);
    const isSakura = p.kind === 'sakura';
    g.fillStyle = isSakura ? '#f472b6' : '#15803d';
    g.beginPath();
    g.arc(cx + sway, cy - 18, 24, 0, Math.PI * 2);
    g.arc(cx - 14 + sway, cy - 10, 17, 0, Math.PI * 2);
    g.arc(cx + 14 + sway, cy - 10, 17, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = isSakura ? '#fbcfe8' : '#22c55e';
    g.beginPath();
    g.arc(cx - 4 + sway, cy - 23, 14, 0, Math.PI * 2);
    g.fill();
  } else if (p.type === 'campfire') {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    g.fillStyle = '#451a03';
    g.fillRect(cx - 16, cy - 4, 32, 8);
    g.fillRect(cx - 4, cy - 16, 8, 32);
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, 18, 0, Math.PI * 2);
    g.stroke();
    const flicker = Math.sin(time * 0.02) * 3;
    g.fillStyle = '#f97316';
    g.beginPath();
    g.arc(cx, cy - 2, 12 + flicker * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fde047';
    g.beginPath();
    g.arc(cx, cy - 4, 7 - flicker * 0.2, 0, Math.PI * 2);
    g.fill();
  } else if (p.type === 'lantern') {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    g.fillStyle = '#334155';
    g.fillRect(cx - 3, cy - 18, 6, 30);
    g.fillStyle = '#fef08a';
    g.beginPath();
    g.arc(cx, cy - 20, 8, 0, Math.PI * 2);
    g.fill();
  } else if (p.type === 'cafe_counter') {
    g.fillStyle = '#78350f';
    g.beginPath();
    g.roundRect(x + 2, y + 6, p.w * TILE - 4, TILE - 8, 6);
    g.fill();
    g.fillStyle = '#f8fafc';
    g.fillRect(x + 6, y + 8, p.w * TILE - 12, 14);
    g.fillStyle = '#dc2626';
    g.fillRect(x + 18, y + 4, 24, 18);
    g.fillStyle = '#f59e0b';
    g.beginPath();
    g.arc(x + 90, y + 16, 6, 0, Math.PI * 2);
    g.arc(x + 106, y + 16, 6, 0, Math.PI * 2);
    g.fill();
  } else if (p.type === 'bookshelf') {
    g.fillStyle = '#94a3b8';
    g.fillRect(x + 2, y + 2, p.w * TILE - 4, TILE - 6);
    const bookColors = ['#ef4444', '#3b82f6', '#10b981', '#eab308', '#a855f7'];
    for (let b = 8; b < p.w * TILE - 12; b += 10) {
      g.fillStyle = bookColors[(b / 10) % bookColors.length];
      g.fillRect(x + b, y + 10, 7, 14);
      g.fillRect(x + b, y + 28, 7, 12);
    }
  } else if (p.type === 'sofa_horiz') {
    g.fillStyle = p.color || '#f59e0b';
    g.beginPath();
    g.roundRect(x + 2, y + 4, p.w * TILE - 4, TILE - 8, 8);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(x + 4, y + 4, p.w * TILE - 8, 10);
  } else if (p.type === 'round_table' || p.type === 'media_table') {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    g.fillStyle = p.type === 'round_table' ? '#e2b887' : '#334155';
    g.beginPath();
    g.ellipse(cx, cy, 22, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    g.stroke();
  } else if (p.type === 'pingpong') {
    g.fillStyle = '#10b981';
    g.fillRect(x + 6, y + 6, p.w * TILE - 12, p.h * TILE - 12);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.strokeRect(x + 8, y + 8, p.w * TILE - 16, p.h * TILE - 16);
    g.beginPath();
    g.moveTo(x + p.w * TILE / 2, y + 8);
    g.lineTo(x + p.w * TILE / 2, y + p.h * TILE - 8);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(x + 4, y + (p.h * TILE) / 2 - 2, p.w * TILE - 8, 4);
  } else if (p.type === 'arcade') {
    g.fillStyle = '#1e293b';
    g.fillRect(x + 8, y + 4, TILE - 16, TILE - 8);
    g.fillStyle = p.color || '#06b6d4';
    g.fillRect(x + 12, y + 10, TILE - 24, 16);
  } else if (p.type === 'desk_pod') {
    g.fillStyle = '#f8fafc';
    g.beginPath();
    g.roundRect(x + 2, y + 10, p.w * TILE - 4, TILE - 14, 4);
    g.fill();
    g.fillStyle = '#1e293b';
    g.fillRect(x + 12, y + 14, 24, 14);
    g.fillRect(x + 56, y + 14, 24, 14);
    g.fillStyle = '#38bdf8';
    g.fillRect(x + 14, y + 16, 20, 10);
    g.fillRect(x + 58, y + 16, 20, 10);
  } else if (p.type === 'picnic_table') {
    g.fillStyle = '#b45309';
    g.beginPath();
    g.roundRect(x + 4, y + 8, p.w * TILE - 8, TILE - 16, 4);
    g.fill();
  } else if (p.type === 'plant') {
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    g.fillStyle = '#475569';
    g.beginPath();
    g.arc(cx, cy + 8, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#22c55e';
    g.beginPath();
    g.arc(cx, cy - 2, 13, 0, Math.PI * 2);
    g.arc(cx - 8, cy + 2, 9, 0, Math.PI * 2);
    g.arc(cx + 8, cy + 2, 9, 0, Math.PI * 2);
    g.fill();
  } else if (p.type === 'seat' && p.seat) {
    const s = p.seat;
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    if (s.style === 'beanbag') {
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(cx, cy + 2, 15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath();
      g.arc(cx - 4, cy - 2, 6, 0, Math.PI * 2);
      g.fill();
    } else if (s.style === 'bench' || s.style === 'log_seat') {
      g.fillStyle = s.color;
      g.beginPath();
      g.roundRect(x + 8, y + 12, TILE - 16, TILE - 24, 6);
      g.fill();
    } else if (s.style === 'stool' || s.style === 'office_chair') {
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(cx, cy + 4, 11, 0, Math.PI * 2);
      g.fill();
    }
  }
}
