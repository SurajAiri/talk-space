import { mapThumbnail } from '../world/thumbnail'
import { loadWorldMap } from '../world/maps'

/** Preview of a room's map. Falls back to a plain tile if the map is unknown (older rooms). */
export default function MapThumb({ mapKey, className = '' }: { mapKey: string | undefined; className?: string }) {
  const map = loadWorldMap(mapKey)
  const src = map ? mapThumbnail(map) : null
  return src ? (
    <img className={`map-thumb ${className}`} src={src} alt="" loading="lazy" draggable={false} />
  ) : (
    <span className={`map-thumb map-thumb-empty ${className}`} aria-hidden="true" />
  )
}
