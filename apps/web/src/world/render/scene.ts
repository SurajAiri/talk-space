import { drawProp } from '../assets/props.ts'
import { drawTile } from '../assets/tiles.ts'

/** Draw tiles [startCol..endCol] x [startRow..endRow] (inclusive) of a tile-id grid. */
export function drawWorldTiles(
  g: CanvasRenderingContext2D,
  grid: number[][],
  startCol: number,
  endCol: number,
  startRow: number,
  endRow: number,
  time: number,
) {
  for (let r = startRow; r <= endRow; r++) {
    const row = grid[r]
    if (!row) continue
    for (let c = startCol; c <= endCol; c++) {
      const id = row[c]
      if (id !== undefined) drawTile(g, id, c, r, time)
    }
  }
}

export { drawProp as drawPropItem }
