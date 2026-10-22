import { useEffect, useRef } from 'react'
import { drawProp } from '../assets/props.ts'
import { drawTile } from '../assets/tiles.ts'
import { TILE, type Prop } from '../types.ts'

/** Tiny canvases that show an asset exactly as the game draws it. */

export function TileSwatch({ id, size = 36 }: { id: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const g = ref.current?.getContext('2d')
    if (!g) return
    g.setTransform(1, 0, 0, 1, -TILE, -TILE)
    drawTile(g, id, 1, 1, 0) // (1,1) so checker patterns show both shades
  }, [id])
  return <canvas ref={ref} width={TILE} height={TILE} style={{ width: size, height: size, borderRadius: 4 }} />
}

/** A prop (or seat) on a grass backdrop, scaled to fit. */
export function PropSwatch({ prop, size = 52 }: { prop: Prop; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const g = ref.current?.getContext('2d')
    if (!g) return
    const S = 64
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.fillStyle = '#3f8f4e'
    g.fillRect(0, 0, S, S)
    const pw = prop.w * TILE
    const ph = prop.h * TILE
    const k = Math.min((S - 4) / pw, (S - 4) / ph, 1)
    g.setTransform(k, 0, 0, k, (S - pw * k) / 2, (S - ph * k) / 2)
    drawProp(g, { ...prop, col: 0, row: 0 }, 0)
  }, [prop])
  return <canvas ref={ref} width={64} height={64} style={{ width: size, height: size, borderRadius: 4 }} />
}
