/**
 * PROP ASSET PACK: everything that can be placed ON TOP of tiles.
 *
 * To add a prop: write its draw function (pixel coordinates; the prop's top-left is
 * p.col * TILE, p.row * TILE and it covers p.w x p.h tiles) and add ONE entry to
 * PROP_CATALOG. Nothing else needs to change: the editor palette, the map validator,
 * the CLI and the file format all read this list.
 *
 * Pure data + canvas calls, no DOM or app imports, so the whole `assets/` folder can be
 * copied into another project (together with `../types.ts`).
 */
import { TILE, type Prop } from '../types.ts'

export type PropResize = 'none' | 'w' | 'wh'

export interface PropDef {
  type: string
  label: string
  /** default size in tiles */
  w: number
  h: number
  /** blocks walking */
  solid: boolean
  /** which dimensions the editor / validator allow to differ from the default */
  resize: PropResize
  minW?: number
  minH?: number
  /** optional named looks, stored as `variant` in the map file; first one is the default */
  variants?: readonly string[]
  /** default tint. Present = this prop can be tinted with `color` in the map file */
  color?: string
  /** internal types (seats) are created through their own list, not the props palette */
  hidden?: boolean
  draw: (g: CanvasRenderingContext2D, p: Prop, time: number) => void
}

function drawFountain(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
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
}

function drawTree(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  const sway = Math.sin(time * 0.0025 + p.col) * 2;
  g.fillStyle = 'rgba(15, 23, 42, 0.28)';
  g.beginPath();
  g.ellipse(cx, cy + 16, 22, 9, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#78350f';
  g.fillRect(cx - 6, cy - 4, 12, 20);
  const isSakura = p.variant === 'sakura';
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
}

function drawCampfire(g: CanvasRenderingContext2D, p: Prop, time: number) {
  const x = p.col * TILE
  const y = p.row * TILE
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
}

function drawLantern(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  g.fillStyle = '#334155';
  g.fillRect(cx - 3, cy - 18, 6, 30);
  g.fillStyle = '#fef08a';
  g.beginPath();
  g.arc(cx, cy - 20, 8, 0, Math.PI * 2);
  g.fill();
}

function drawCafeCounter(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
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
}

function drawBookshelf(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = '#94a3b8';
  g.fillRect(x + 2, y + 2, p.w * TILE - 4, TILE - 6);
  const bookColors = ['#ef4444', '#3b82f6', '#10b981', '#eab308', '#a855f7'];
  for (let b = 8; b < p.w * TILE - 12; b += 10) {
    g.fillStyle = bookColors[(b / 10) % bookColors.length];
    g.fillRect(x + b, y + 10, 7, 14);
    g.fillRect(x + b, y + 28, 7, 12);
  }
}

function drawSofaHoriz(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = p.color || '#f59e0b';
  g.beginPath();
  g.roundRect(x + 2, y + 4, p.w * TILE - 4, TILE - 8, 8);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.fillRect(x + 4, y + 4, p.w * TILE - 8, 10);
}

function drawRoundTable(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  g.fillStyle = p.type === 'round_table' ? '#e2b887' : '#334155';
  g.beginPath();
  g.ellipse(cx, cy, 22, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 2;
  g.stroke();
}

function drawPingpong(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
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
}

function drawArcade(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = '#1e293b';
  g.fillRect(x + 8, y + 4, TILE - 16, TILE - 8);
  g.fillStyle = p.color || '#06b6d4';
  g.fillRect(x + 12, y + 10, TILE - 24, 16);
}

function drawDeskPod(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
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
}

function drawPicnicTable(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
  g.fillStyle = '#b45309';
  g.beginPath();
  g.roundRect(x + 4, y + 8, p.w * TILE - 8, TILE - 16, 4);
  g.fill();
}

function drawPlant(g: CanvasRenderingContext2D, p: Prop) {
  const x = p.col * TILE
  const y = p.row * TILE
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
}

function drawSeat(g: CanvasRenderingContext2D, p: Prop) {
  const s = p.seat
  if (!s) return
  const x = p.col * TILE
  const y = p.row * TILE
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

export const PROP_CATALOG: readonly PropDef[] = [
  { type: 'tree', label: 'Tree', w: 1, h: 1, solid: true, resize: 'none', variants: ['oak', 'sakura'], draw: drawTree },
  { type: 'plant', label: 'Potted plant', w: 1, h: 1, solid: true, resize: 'none', draw: drawPlant },
  { type: 'lantern', label: 'Lantern', w: 1, h: 1, solid: true, resize: 'none', draw: drawLantern },
  { type: 'campfire', label: 'Campfire', w: 1, h: 1, solid: true, resize: 'none', draw: drawCampfire },
  { type: 'fountain', label: 'Fountain', w: 2, h: 2, solid: true, resize: 'none', draw: drawFountain },
  { type: 'cafe_counter', label: 'Café counter', w: 3, h: 1, solid: true, resize: 'w', minW: 3, draw: drawCafeCounter },
  { type: 'bookshelf', label: 'Bookshelf', w: 2, h: 1, solid: true, resize: 'w', minW: 1, draw: drawBookshelf },
  { type: 'sofa_horiz', label: 'Sofa (walk-through)', w: 3, h: 1, solid: false, resize: 'w', minW: 2, color: '#f59e0b', draw: drawSofaHoriz },
  { type: 'round_table', label: 'Round table', w: 1, h: 1, solid: true, resize: 'none', draw: drawRoundTable },
  { type: 'media_table', label: 'Media table', w: 1, h: 1, solid: true, resize: 'none', draw: drawRoundTable },
  { type: 'pingpong', label: 'Ping-pong table', w: 2, h: 3, solid: true, resize: 'wh', minW: 1, minH: 1, draw: drawPingpong },
  { type: 'arcade', label: 'Arcade cabinet', w: 1, h: 1, solid: true, resize: 'none', color: '#06b6d4', draw: drawArcade },
  { type: 'desk_pod', label: 'Desk pod', w: 2, h: 1, solid: true, resize: 'w', minW: 1, draw: drawDeskPod },
  { type: 'picnic_table', label: 'Picnic table', w: 2, h: 1, solid: true, resize: 'w', minW: 1, draw: drawPicnicTable },
  { type: 'seat', label: 'Seat', w: 1, h: 1, solid: false, resize: 'none', hidden: true, draw: drawSeat },
]

const BY_TYPE = new Map(PROP_CATALOG.map((d) => [d.type, d]))
export const propDef = (type: string): PropDef | undefined => BY_TYPE.get(type)

/** Draw one prop. Unknown types draw nothing (so a typo never crashes a room). */
export function drawProp(g: CanvasRenderingContext2D, p: Prop, time: number) {
  BY_TYPE.get(p.type)?.draw(g, p, time)
}

/**
 * Seats are walk-on spots (you sit when you stop on one). `sofa_cushion` draws nothing
 * on purpose: it is meant to sit on top of a `sofa_horiz`, which already draws the cushion.
 */
export const SEAT_STYLES = ['bench', 'stool', 'sofa_cushion', 'beanbag', 'office_chair', 'log_seat'] as const
export type SeatStyle = (typeof SEAT_STYLES)[number]
