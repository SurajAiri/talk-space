// Ported from the GatherSpace template.
// Tile ids: 0 grass, 1 cobble, 2 cafe, 3 rec room, 4 studio, 5 wall, 6 water, 7 deck, 8 flowers, 9 sand.
import { TILE } from '../types'

export function drawWorldTiles(
  g: CanvasRenderingContext2D,
  mapGrid: number[][],
  startCol: number,
  endCol: number,
  startRow: number,
  endRow: number,
  time: number,
) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const x = c * TILE;
      const y = r * TILE;
      const t = mapGrid[r][c];

      if (t === 0 || t === 8) {
        g.fillStyle = (c + r) % 2 === 0 ? '#3f8f4e' : '#3a8648';
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = '#4da65d';
        if ((c * 7 + r * 13) % 3 === 0) {
          g.fillRect(x + 10, y + 12, 3, 6);
          g.fillRect(x + 14, y + 14, 3, 4);
        }
        if (t === 8) {
          const sway = Math.sin(time * 0.004 + c + r) * 1.5;
          g.fillStyle = (c + r) % 2 === 0 ? '#f472b6' : '#facc15';
          g.beginPath();
          g.arc(x + 14 + sway, y + 16, 4, 0, Math.PI * 2);
          g.arc(x + 32 - sway, y + 30, 4, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = '#ffffff';
          g.fillRect(x + 13 + sway, y + 15, 2, 2);
          g.fillRect(x + 31 - sway, y + 29, 2, 2);
        }
      } else if (t === 1) {
        g.fillStyle = '#cbd5e1';
        g.fillRect(x, y, TILE, TILE);
        g.strokeStyle = '#94a3b8';
        g.lineWidth = 1;
        g.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        g.fillStyle = '#e2e8f0';
        g.fillRect(x + 6, y + 6, 14, 12);
        g.fillRect(x + 24, y + 24, 16, 14);
      } else if (t === 2) {
        g.fillStyle = (c + r) % 2 === 0 ? '#d9a066' : '#d1975e';
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = 'rgba(120, 53, 15, 0.16)';
        g.fillRect(x, y + 15, TILE, 1.5);
        g.fillRect(x, y + 31, TILE, 1.5);
      } else if (t === 3) {
        g.fillStyle = c % 2 === 0 ? '#818cf8' : '#747ff2';
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
      } else if (t === 4) {
        g.fillStyle = (c + r) % 2 === 0 ? '#94a3b8' : '#8999ae';
        g.fillRect(x, y, TILE, TILE);
      } else if (t === 5) {
        g.fillStyle = '#475569';
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = '#cbd5e1';
        g.fillRect(x, y, TILE, 12);
        g.fillStyle = '#334155';
        g.fillRect(x, y + TILE - 6, TILE, 6);
      } else if (t === 6) {
        g.fillStyle = '#0284c7';
        g.fillRect(x, y, TILE, TILE);
        const wave = Math.sin(time * 0.003 + c * 0.8 + r * 0.5) * 4;
        g.fillStyle = 'rgba(125, 211, 252, 0.45)';
        g.fillRect(x + 8 + wave, y + 14, 18, 3);
        g.fillRect(x + 18 - wave, y + 32, 14, 3);
      } else if (t === 7) {
        g.fillStyle = '#92400e';
        g.fillRect(x, y, TILE, TILE);
        g.fillStyle = '#78350f';
        for (let p = 8; p < TILE; p += 12) g.fillRect(x, y + p, TILE, 2);
      } else if (t === 9) {
        // Golden Beach Sand with subtle shell speckles
        g.fillStyle = (c + r) % 2 === 0 ? '#fde68a' : '#fcd34d';
        g.fillRect(x, y, TILE, TILE);
        if ((c * 5 + r * 9) % 7 === 0) {
          g.fillStyle = '#f59e0b';
          g.fillRect(x + 18, y + 22, 3, 3);
        }
      }
    }
  }
}
