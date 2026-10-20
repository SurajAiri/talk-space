import { useEffect, useState } from 'react'
import { loadRoomConfig, type RoomConfig } from '../lib/rooms'

export function useRoomConfig(): RoomConfig | null {
  const [config, setConfig] = useState<RoomConfig | null>(null)
  useEffect(() => {
    let cancelled = false
    loadRoomConfig()
      .then((c) => !cancelled && setConfig(c))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return config
}
