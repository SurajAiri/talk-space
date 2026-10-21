import type { Dir, Prop, Seat, WorldMap } from '../types'
import { createEmptyGrid, fillRect } from './helpers'

export function buildBeachMap(): WorldMap {
  const g = createEmptyGrid(9); // Warm golden sand
  const props: Prop[] = [];
  const seats: Seat[] = [];

  const addProp = (col: number, row: number, w: number, h: number, type: string, solid = true, extra: Partial<Prop> = {}) =>
    props.push({ col, row, w, h, type, solid, ...extra });
  const addSeat = (col: number, row: number, dir: Dir, style: string, color = '#38bdf8') => {
    const seat = { id: 'beach_seat_' + seats.length, col, row, dir, style, color };
    seats.push(seat);
    addProp(col, row, 1, 1, 'seat', false, { seat });
  };

  // Lush Tropical Grass Rim along North
  fillRect(g, 0, 0, 43, 6, 0);
  fillRect(g, 0, 7, 43, 8, 8);
  // Ocean Waves along South & East
  fillRect(g, 0, 24, 43, 31, 6);
  fillRect(g, 37, 14, 43, 31, 6);

  // Wooden Coastal Boardwalk & Overwater Pier
  fillRect(g, 2, 15, 36, 17, 7);
  fillRect(g, 19, 17, 23, 28, 7); // Overwater Sunset Pier
  fillRect(g, 28, 8, 35, 14, 7);  // Tiki Bar Deck

  // Tiki Smoothie & Coconut Bar
  addProp(29, 9, 5, 1, 'cafe_counter', true);
  addSeat(29, 11, 'up', 'stool', '#f97316');
  addSeat(31, 11, 'up', 'stool', '#f97316');
  addSeat(33, 11, 'up', 'stool', '#f97316');

  // Beach Volleyball Court (cols 8..13, rows 10..12)
  addProp(8, 10, 2, 3, 'pingpong', true);

  // Beach Bonfire Circle
  addProp(12, 20, 1, 1, 'campfire', true);
  addSeat(12, 18, 'down', 'log_seat', '#b45309');
  addSeat(10, 20, 'right', 'log_seat', '#b45309');
  addSeat(14, 20, 'left', 'log_seat', '#b45309');
  addSeat(12, 22, 'up', 'log_seat', '#b45309');

  // Colorful Beach Lounge Beanbags & Umbrellas facing the ocean
  addSeat(26, 20, 'down', 'beanbag', '#f43f5e');
  addSeat(28, 20, 'down', 'beanbag', '#06b6d4');
  addSeat(30, 20, 'down', 'beanbag', '#eab308');
  addSeat(32, 20, 'down', 'beanbag', '#a855f7');

  // Overwater Pier Benches
  addSeat(19, 26, 'right', 'bench', '#d97706');
  addSeat(23, 26, 'left', 'bench', '#d97706');

  // Palm / Sakura Trees & Lanterns
  ([[4, 5, 'oak'], [10, 5, 'sakura'], [16, 5, 'oak'], [24, 5, 'sakura'], [36, 5, 'oak'], [6, 19, 'oak'], [34, 19, 'sakura']] as [number, number, string][]).forEach(([c, r, kind]) => addProp(c, r, 1, 1, 'tree', true, { kind }));
  [[6, 15], [18, 15], [24, 15], [35, 15], [19, 23], [23, 23], [19, 27], [23, 27]].forEach(([c, r]) => addProp(c, r, 1, 1, 'lantern', true));

  return {
    key: 'beach',
    title: 'Sunset Beach',
    grid: g,
    props,
    seats,
    zones: [
      { id: 'tiki', name: 'Tiki Smoothie Deck', rect: { c1: 28, r1: 8, c2: 35, r2: 14 } },
      { id: 'bonfire', name: 'Bonfire Circle', rect: { c1: 8, r1: 17, c2: 16, r2: 23 } },
      { id: 'pier', name: 'Overwater Pier', rect: { c1: 19, r1: 24, c2: 23, r2: 28 } },
    ],
    spawn: { col: 21, row: 16 },
  }
}
