/**
 * TILE ASSET PACK: the ground layer. One entry per tile type.
 *
 * To add a tile: write a draw function (x, y = pixel top-left of the cell, c, r = its
 * column/row so you can vary the pattern) and add ONE entry to TILESET with a unique
 * numeric `id` and a unique single-character `char`. The map file format, the editor
 * palette and the CLI pick it up automatically. Never reuse or renumber a `char` that
 * existing map files already use.
 *
 * Pure canvas code, no app imports, safe to copy into another project with `../types.ts`.
 */
import { TILE } from '../types.ts'

export type TileCategory = 'ground' | 'floor' | 'wall' | 'water'

export interface TileDef {
  /** numeric id used at runtime */
  id: number
  /** the character used for this tile in map files (`tiles` rows) */
  char: string
  name: string
  category: TileCategory
  /** blocks walking */
  solid: boolean
  /** flat colour for tiny UI swatches / fallbacks */
  swatch: string
  draw: (g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number, time: number) => void
}

function drawGrass(g: CanvasRenderingContext2D, x: number, y: number, c: number, r: number) {
  g.fillStyle = (c + r) % 2 === 0 ? '#3f8f4e' : '#3a8648'
  g.fillRect(x, y, TILE, TILE)
  g.fillStyle = '#4da65d'
  if ((c * 7 + r * 13) % 3 === 0) {
    g.fillRect(x + 10, y + 12, 3, 6)
    g.fillRect(x + 14, y + 14, 3, 4)
  }
}

export const TILESET: readonly TileDef[] = [
  { id: 0, char: '.', name: 'Grass', category: 'ground', solid: false, swatch: '#3f8f4e', draw: drawGrass },
  {
    id: 8, char: '*', name: 'Flower meadow', category: 'ground', solid: false, swatch: '#f472b6',
    draw(g, x, y, c, r, time) {
      drawGrass(g, x, y, c, r)
      const sway = Math.sin(time * 0.004 + c + r) * 1.5
      g.fillStyle = (c + r) % 2 === 0 ? '#f472b6' : '#facc15'
      g.beginPath()
      g.arc(x + 14 + sway, y + 16, 4, 0, Math.PI * 2)
      g.arc(x + 32 - sway, y + 30, 4, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#ffffff'
      g.fillRect(x + 13 + sway, y + 15, 2, 2)
      g.fillRect(x + 31 - sway, y + 29, 2, 2)
    },
  },
  {
    id: 9, char: ':', name: 'Sand', category: 'ground', solid: false, swatch: '#fde68a',
    draw(g, x, y, c, r) {
      g.fillStyle = (c + r) % 2 === 0 ? '#fde68a' : '#fcd34d'
      g.fillRect(x, y, TILE, TILE)
      if ((c * 5 + r * 9) % 7 === 0) {
        g.fillStyle = '#f59e0b'
        g.fillRect(x + 18, y + 22, 3, 3)
      }
    },
  },
  {
    id: 1, char: ',', name: 'Cobblestone', category: 'ground', solid: false, swatch: '#cbd5e1',
    draw(g, x, y) {
      g.fillStyle = '#cbd5e1'
      g.fillRect(x, y, TILE, TILE)
      g.strokeStyle = '#94a3b8'
      g.lineWidth = 1
      g.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4)
      g.fillStyle = '#e2e8f0'
      g.fillRect(x + 6, y + 6, 14, 12)
      g.fillRect(x + 24, y + 24, 16, 14)
    },
  },
  {
    id: 7, char: '=', name: 'Wooden deck', category: 'floor', solid: false, swatch: '#92400e',
    draw(g, x, y) {
      g.fillStyle = '#92400e'
      g.fillRect(x, y, TILE, TILE)
      g.fillStyle = '#78350f'
      for (let p = 8; p < TILE; p += 12) g.fillRect(x, y + p, TILE, 2)
    },
  },
  {
    id: 2, char: 'c', name: 'Café floor', category: 'floor', solid: false, swatch: '#d9a066',
    draw(g, x, y, c, r) {
      g.fillStyle = (c + r) % 2 === 0 ? '#d9a066' : '#d1975e'
      g.fillRect(x, y, TILE, TILE)
      g.fillStyle = 'rgba(120, 53, 15, 0.16)'
      g.fillRect(x, y + 15, TILE, 1.5)
      g.fillRect(x, y + 31, TILE, 1.5)
    },
  },
  {
    id: 3, char: 'r', name: 'Rec-room floor', category: 'floor', solid: false, swatch: '#818cf8',
    draw(g, x, y, c) {
      g.fillStyle = c % 2 === 0 ? '#818cf8' : '#747ff2'
      g.fillRect(x, y, TILE, TILE)
      g.fillStyle = 'rgba(255,255,255,0.06)'
      g.fillRect(x + 4, y + 4, TILE - 8, TILE - 8)
    },
  },
  {
    id: 4, char: 's', name: 'Studio floor', category: 'floor', solid: false, swatch: '#94a3b8',
    draw(g, x, y, c, r) {
      g.fillStyle = (c + r) % 2 === 0 ? '#94a3b8' : '#8999ae'
      g.fillRect(x, y, TILE, TILE)
    },
  },
  {
    id: 5, char: '#', name: 'Wall', category: 'wall', solid: true, swatch: '#475569',
    draw(g, x, y) {
      g.fillStyle = '#475569'
      g.fillRect(x, y, TILE, TILE)
      g.fillStyle = '#cbd5e1'
      g.fillRect(x, y, TILE, 12)
      g.fillStyle = '#334155'
      g.fillRect(x, y + TILE - 6, TILE, 6)
    },
  },
  {
    id: 6, char: '~', name: 'Water', category: 'water', solid: true, swatch: '#0284c7',
    draw(g, x, y, c, r, time) {
      g.fillStyle = '#0284c7'
      g.fillRect(x, y, TILE, TILE)
      const wave = Math.sin(time * 0.003 + c * 0.8 + r * 0.5) * 4
      g.fillStyle = 'rgba(125, 211, 252, 0.45)'
      g.fillRect(x + 8 + wave, y + 14, 18, 3)
      g.fillRect(x + 18 - wave, y + 32, 14, 3)
    },
  },
]

const BY_ID = new Map(TILESET.map((t) => [t.id, t]))
const BY_CHAR = new Map(TILESET.map((t) => [t.char, t]))
export const tileById = (id: number): TileDef | undefined => BY_ID.get(id)
export const tileByChar = (ch: string): TileDef | undefined => BY_CHAR.get(ch)
/** The tile new maps are filled with. */
export const DEFAULT_TILE: TileDef = TILESET[0]!

export function drawTile(g: CanvasRenderingContext2D, id: number, c: number, r: number, time: number) {
  BY_ID.get(id)?.draw(g, c * TILE, r * TILE, c, r, time)
}
