import { propDef } from '../assets/props.ts'
import type { Prop } from '../types.ts'

/** A default-sized instance of a catalog prop (for palette previews). */
export const catalogProp = (type: string, variant?: string): Prop => {
  const d = propDef(type)!
  return { type, col: 0, row: 0, w: d.w, h: d.h, solid: d.solid, ...(variant ? { variant } : {}), ...(d.color ? { color: d.color } : {}) }
}
