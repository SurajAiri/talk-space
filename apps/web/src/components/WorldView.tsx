import { useEffect, useRef, useState } from 'react'
import { useRoomStore } from '../store/room.store'
import { useAuthStore } from '../store/auth.store'
import { HEARING } from '../world/hearing'
import type { HudSnapshot, WorldSession } from '../world/WorldSession'
import { WorldEngine } from '../world/WorldEngine'

/** The map plus a plain-text readout of who can hear you and why. */
export default function WorldView({ session }: { session: WorldSession }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const selfId = useRoomStore((s) => s.selfId)
  const peers = useRoomStore((s) => s.peers)
  const [hud, setHud] = useState<HudSnapshot>({ zoneName: null, hearing: {} })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !selfId) return
    const engine = new WorldEngine({
      canvas,
      session,
      selfId,
      // read live every frame, deliberately outside React state
      getSelf: () => ({
        name: useAuthStore.getState().user?.name ?? 'You',
        muted: useRoomStore.getState().muted,
      }),
      getPeers: () => useRoomStore.getState().peers,
    })
    engine.start()
    const unsubscribe = session.subscribe(setHud)
    return () => {
      unsubscribe()
      engine.destroy()
    }
  }, [session, selfId])

  const audible = Object.entries(hud.hearing)
    .filter(([, g]) => g > 0)
    .map(([id, g]) => ({ name: peers[id]?.name ?? 'Someone', pct: Math.round(g * 100) }))
  const total = Object.keys(hud.hearing).length

  return (
    <div className="world">
      <canvas ref={canvasRef} className="world-canvas" aria-label="Room map" />
      <div className="world-hud" aria-live="polite">
        <strong>{hud.zoneName ? `🔊 ${hud.zoneName}` : '🌿 Open area'}</strong>
        <span>
          {hud.zoneName
            ? 'Everyone in this area hears each other, however far apart.'
            : `Only people within ~${HEARING.maxRadius} tiles hear you; they fade with distance.`}
        </span>
        <span>
          {total === 0
            ? 'Nobody else is here yet.'
            : audible.length === 0
              ? 'Nobody can hear you right now. Walk closer, or into a marked area.'
              : `In earshot: ${audible.map((a) => `${a.name} ${a.pct}%`).join(', ')}`}
        </span>
      </div>
      <p className="world-help">Move: WASD / arrow keys, or click / tap a spot. Scroll to zoom.</p>
    </div>
  )
}
