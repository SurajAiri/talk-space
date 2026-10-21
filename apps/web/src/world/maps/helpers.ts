import { MAP_COLS, MAP_ROWS } from '../types'

export function createEmptyGrid(defaultTile = 0): number[][] {
  return Array.from({ length: MAP_ROWS }, () => Array<number>(MAP_COLS).fill(defaultTile))
}

export function fillRect(g: number[][], c1: number, r1: number, c2: number, r2: number, val: number) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) g[r]![c] = val
    }
  }
}

export function strokeWallRect(g: number[][], c1: number, r1: number, c2: number, r2: number) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      if (r === r1 || r === r2 || c === c1 || c === c2) g[r]![c] = 5
    }
  }
}
