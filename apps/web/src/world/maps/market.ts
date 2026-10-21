import type { Dir, Prop, Seat, WorldMap } from '../types'
import { createEmptyGrid, fillRect, strokeWallRect } from './helpers'

export function buildMarketMap(): WorldMap {
  const g = createEmptyGrid(1); // Cobblestone plaza base
  const props: Prop[] = [];
  const seats: Seat[] = [];

  const addProp = (col: number, row: number, w: number, h: number, type: string, solid = true, extra: Partial<Prop> = {}) =>
    props.push({ col, row, w, h, type, solid, ...extra });
  const addSeat = (col: number, row: number, dir: Dir, style: string, color = '#ec4899') => {
    const seat = { id: 'market_seat_' + seats.length, col, row, dir, style, color };
    seats.push(seat);
    addProp(col, row, 1, 1, 'seat', false, { seat });
  };

  // Surrounding Lotus Koi Pond & Gardens
  fillRect(g, 0, 0, 43, 3, 6);
  fillRect(g, 0, 4, 43, 6, 8);
  fillRect(g, 3, 10, 14, 22, 6); // West Lotus Pond
  fillRect(g, 6, 15, 11, 17, 7); // Wooden Tea Pavilion Island over pond
  fillRect(g, 12, 16, 17, 16, 7); // Bridge to Tea Island

  // East Glass Botanical Conservatory (cols 29..40, rows 9..22)
  fillRect(g, 29, 9, 40, 22, 2);
  strokeWallRect(g, 29, 9, 40, 22);
  g[15][29] = 2; g[16][29] = 2;

  // Central Night Market Street Carpet
  fillRect(g, 20, 7, 24, 28, 3);

  // Ramen & Boba Stalls along Market Alley
  addProp(17, 9, 3, 1, 'cafe_counter', true);
  addSeat(17, 11, 'up', 'stool', '#ef4444');
  addSeat(19, 11, 'up', 'stool', '#ef4444');

  addProp(25, 9, 3, 1, 'cafe_counter', true);
  addSeat(25, 11, 'up', 'stool', '#a855f7');
  addSeat(27, 11, 'up', 'stool', '#a855f7');

  // Central Courtyard Fountain
  addProp(21, 16, 2, 2, 'fountain', true);

  // Tea Island Cushion Seats
  addProp(8, 16, 1, 1, 'round_table', true);
  addSeat(7, 16, 'right', 'beanbag', '#10b981');
  addSeat(9, 16, 'left', 'beanbag', '#f59e0b');

  // Botanical Conservatory Sofas & Study Tables
  addProp(33, 12, 3, 1, 'sofa_horiz', false, { color: '#10b981' });
  addSeat(33, 12, 'down', 'sofa_cushion', '#10b981');
  addSeat(34, 12, 'down', 'sofa_cushion', '#10b981');
  addSeat(35, 12, 'down', 'sofa_cushion', '#10b981');
  addProp(34, 15, 1, 1, 'round_table', true);
  addSeat(32, 15, 'right', 'beanbag', '#ec4899');
  addSeat(36, 15, 'left', 'beanbag', '#38bdf8');

  // Many Glowing Lanterns lining the Night Market Alley & Sakura Trees
  for (let r = 8; r <= 26; r += 3) {
    addProp(19, r, 1, 1, 'lantern', true);
    addProp(25, r, 1, 1, 'lantern', true);
  }
  ([[16, 6, 'sakura'], [28, 6, 'sakura'], [16, 24, 'sakura'], [28, 24, 'sakura'], [31, 11, 'sakura'], [38, 11, 'oak'], [31, 20, 'oak'], [38, 20, 'sakura']] as [number, number, string][]).forEach(([c, r, kind]) => addProp(c, r, 1, 1, 'tree', true, { kind }));

  return {
    key: 'market',
    title: 'Sky Night Market',
    grid: g,
    props,
    seats,
    zones: [
      { id: 'conservatory', name: 'Glass Conservatory', rect: { c1: 29, r1: 9, c2: 40, r2: 22 } },
      { id: 'tea', name: 'Lotus Tea Pavilion', rect: { c1: 6, r1: 15, c2: 11, r2: 17 } },
    ],
    spawn: { col: 22, row: 20 },
  }
}
