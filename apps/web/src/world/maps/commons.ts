import type { Dir, Prop, Seat, WorldMap } from '../types'
import { createEmptyGrid, fillRect, strokeWallRect } from './helpers'

export function buildCommonsMap(): WorldMap {
  const g = createEmptyGrid(0);
  const props: Prop[] = [];
  const seats: Seat[] = [];

  const addProp = (col: number, row: number, w: number, h: number, type: string, solid = true, extra: Partial<Prop> = {}) =>
    props.push({ col, row, w, h, type, solid, ...extra });
  const addSeat = (col: number, row: number, dir: Dir, style: string, color = '#6366f1') => {
    const seat = { id: 'seat_' + seats.length, col, row, dir, style, color };
    seats.push(seat);
    addProp(col, row, 1, 1, 'seat', false, { seat });
  };

  // Cafe & Lounge
  fillRect(g, 2, 2, 16, 13, 2);
  strokeWallRect(g, 2, 2, 16, 13);
  g[13][8] = 2; g[13][9] = 2; g[13][10] = 2;
  g[7][16] = 2; g[8][16] = 2;

  // Game & Rec Room
  fillRect(g, 2, 17, 16, 28, 3);
  strokeWallRect(g, 2, 17, 16, 28);
  g[17][8] = 3; g[17][9] = 3; g[17][10] = 3;
  g[22][16] = 3; g[23][16] = 3;

  // Creative Studio Nook
  fillRect(g, 29, 2, 41, 12, 4);
  strokeWallRect(g, 29, 2, 41, 12);
  g[7][29] = 4; g[8][29] = 4;
  g[12][34] = 4; g[12][35] = 4;

  // Courtyard & Paths
  fillRect(g, 18, 9, 27, 18, 1);
  fillRect(g, 17, 7, 28, 8, 1);
  fillRect(g, 8, 14, 18, 16, 1);
  fillRect(g, 17, 22, 22, 23, 1);
  fillRect(g, 22, 19, 24, 29, 1);
  fillRect(g, 22, 2, 23, 8, 1);
  fillRect(g, 28, 15, 35, 16, 1);

  // Campfire Deck & Pier
  fillRect(g, 29, 17, 36, 24, 7);
  fillRect(g, 35, 22, 42, 30, 6);
  fillRect(g, 34, 21, 34, 29, 9);
  fillRect(g, 34, 25, 41, 26, 7);

  [[18, 4], [19, 4], [25, 4], [26, 4], [18, 25], [19, 26], [26, 20], [27, 21], [38, 15], [39, 15]].forEach(([c, r]) => {
    if (g[r] && g[r][c] === 0) g[r][c] = 8;
  });

  // Props & Seats
  addProp(22, 13, 2, 2, 'fountain', true);
  addSeat(20, 12, 'right', 'bench', '#b45309');
  addSeat(20, 13, 'right', 'bench', '#b45309');
  addSeat(25, 12, 'left', 'bench', '#b45309');
  addSeat(25, 13, 'left', 'bench', '#b45309');
  addSeat(22, 10, 'down', 'bench', '#b45309');
  addSeat(23, 10, 'down', 'bench', '#b45309');

  addProp(19, 5, 2, 1, 'picnic_table', true);
  addSeat(19, 4, 'down', 'stool', '#d97706');
  addSeat(20, 4, 'down', 'stool', '#d97706');
  addSeat(19, 6, 'up', 'stool', '#d97706');
  addSeat(20, 6, 'up', 'stool', '#d97706');

  ([[17, 3, 'sakura'], [26, 3, 'oak'], [28, 10, 'sakura'], [17, 19, 'oak'], [26, 26, 'sakura'], [20, 28, 'oak'], [38, 14, 'sakura'], [29, 28, 'sakura'], [1, 15, 'oak']] as [number, number, string][]).forEach(([c, r, kind]) => addProp(c, r, 1, 1, 'tree', true, { kind }));
  [[18, 9], [27, 9], [18, 18], [27, 18], [28, 16], [34, 24]].forEach(([c, r]) => addProp(c, r, 1, 1, 'lantern', true));

  addProp(4, 3, 5, 1, 'cafe_counter', true);
  addSeat(4, 5, 'up', 'stool', '#e11d48');
  addSeat(6, 5, 'up', 'stool', '#e11d48');
  addSeat(8, 5, 'up', 'stool', '#e11d48');
  addProp(10, 3, 2, 1, 'bookshelf', true);
  addProp(13, 3, 2, 1, 'bookshelf', true);
  addProp(11, 6, 3, 1, 'sofa_horiz', false, { color: '#f59e0b' });
  addSeat(11, 6, 'down', 'sofa_cushion', '#f59e0b');
  addSeat(12, 6, 'down', 'sofa_cushion', '#f59e0b');
  addSeat(13, 6, 'down', 'sofa_cushion', '#f59e0b');
  addProp(12, 8, 1, 1, 'round_table', true);
  addSeat(10, 8, 'right', 'beanbag', '#ec4899');
  addSeat(14, 8, 'left', 'beanbag', '#a855f7');
  addSeat(12, 10, 'up', 'beanbag', '#3b82f6');
  [[3, 3], [15, 3], [3, 12], [15, 12], [3, 27], [15, 27], [30, 3], [40, 3], [40, 11]].forEach(([c, r]) => addProp(c, r, 1, 1, 'plant', true));

  addProp(4, 21, 2, 3, 'pingpong', true);
  addProp(4, 18, 1, 1, 'arcade', true, { color: '#ec4899' });
  addProp(5, 18, 1, 1, 'arcade', true, { color: '#06b6d4' });
  addProp(11, 19, 3, 1, 'sofa_horiz', false, { color: '#fb923c' });
  addSeat(11, 19, 'down', 'sofa_cushion', '#fb923c');
  addSeat(12, 19, 'down', 'sofa_cushion', '#fb923c');
  addSeat(13, 19, 'down', 'sofa_cushion', '#fb923c');
  addProp(12, 22, 1, 1, 'media_table', true);
  addSeat(10, 22, 'right', 'beanbag', '#10b981');
  addSeat(14, 22, 'left', 'beanbag', '#f43f5e');

  addProp(31, 4, 2, 1, 'desk_pod', true);
  addSeat(31, 5, 'up', 'office_chair', '#475569');
  addSeat(32, 5, 'up', 'office_chair', '#475569');
  addProp(36, 4, 2, 1, 'desk_pod', true);
  addSeat(36, 5, 'up', 'office_chair', '#475569');
  addSeat(37, 5, 'up', 'office_chair', '#475569');
  addProp(31, 8, 2, 1, 'desk_pod', true);
  addSeat(31, 9, 'up', 'office_chair', '#475569');
  addSeat(32, 9, 'up', 'office_chair', '#475569');

  addProp(32, 20, 1, 1, 'campfire', true);
  addSeat(32, 18, 'down', 'log_seat', '#92400e');
  addSeat(30, 20, 'right', 'log_seat', '#92400e');
  addSeat(34, 20, 'left', 'log_seat', '#92400e');
  addSeat(32, 22, 'up', 'log_seat', '#92400e');

  return {
    key: 'commons',
    title: 'Courtyard Commons',
    grid: g,
    props,
    seats,
    zones: [
      { id: 'cafe', name: 'Café & Lounge', rect: { c1: 2, r1: 2, c2: 16, r2: 13 } },
      { id: 'recroom', name: 'Game & Rec Room', rect: { c1: 2, r1: 17, c2: 16, r2: 28 } },
      { id: 'studio', name: 'Creative Maker Nook', rect: { c1: 29, r1: 2, c2: 41, r2: 12 } },
      { id: 'campfire', name: 'Campfire Deck', rect: { c1: 29, r1: 17, c2: 36, r2: 24 } },
    ],
    spawn: { col: 22, row: 16 },
  }
}
