/**
 * A small picture of a map for room cards, drawn with the same tile and prop art the room uses,
 * just scaled down. Made once per map and cached as an image URL.
 */
import { drawProp } from './assets/props.ts'
import { drawTile } from './assets/tiles.ts'
import { TILE, type WorldMap } from './types.ts'

const cache = new Map<string, string>()

export function mapThumbnail(map: WorldMap, width = 320): string | null {
  const hit = cache.get(map.key)
  if (hit) return hit
  if (typeof document === 'undefined') return null

  const scale = width / (map.cols * TILE)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round(map.rows * TILE * scale)
  const g = canvas.getContext('2d')
  if (!g) return null

  g.scale(scale, scale)
  for (let r = 0; r < map.rows; r++) {
    const row = map.grid[r]
    if (!row) continue
    for (let c = 0; c < map.cols; c++) {
      const id = row[c]
      if (id !== undefined) drawTile(g, id, c, r, 0)
    }
  }
  // back to front, so things in front overlap the things behind them
  for (const p of [...map.props].sort((a, b) => a.row + a.h - (b.row + b.h))) drawProp(g, p, 0)

  const url = canvas.toDataURL('image/png')
  cache.set(map.key, url)
  return url
}
