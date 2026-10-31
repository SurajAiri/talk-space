import { useEffect, useRef, useState } from 'react'
import { useRoomStore } from '../store/room.store'
import { useAuthStore } from '../store/auth.store'
import { HEARING } from '../world/hearing'
import type { HudSnapshot, WorldSession } from '../world/WorldSession'
import { WorldEngine } from '../world/WorldEngine'
import Avatar from './Avatar'
import { VolumeIcon, UsersIcon } from './Icons'

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
    .map(([id, g]) => ({ id, name: peers[id]?.name ?? 'Someone', pct: Math.round(g * 100) }))
    .filter((a) => a.pct > 0)
    .sort((x, y) => y.pct - x.pct)
  const total = Object.keys(hud.hearing).length

  return (
    <div className="world">
      <canvas ref={canvasRef} className="world-canvas" aria-label="Room map" />
      <div className="world-hud" aria-live="polite">
        <div className="hud-zone">
          {hud.zoneName ? <VolumeIcon size={17} /> : <UsersIcon size={17} />}
          {hud.zoneName ?? 'Open area'}
        </div>
        <p className="hud-hint">
          {hud.zoneName
            ? 'Everyone in this area hears each other, however far apart.'
            : `Only people within ~${HEARING.maxRadius} tiles hear you; they fade with distance.`}
        </p>
        {total === 0 ? (
          <p className="hud-quiet">Nobody else is here yet.</p>
        ) : audible.length === 0 ? (
          <p className="hud-quiet">Nobody can hear you right now. Walk closer, or into a marked area.</p>
        ) : (
          <ul className="hud-ears" aria-label="In earshot">
            {audible.map((a) => (
              <li className="hud-ear" key={a.id}>
                <Avatar name={a.name} size={22} />
                <span className="hud-ear-name">{a.name}</span>
                <span className="hud-ear-level" aria-hidden="true">
                  <i style={{ width: `${a.pct}%` }} />
                </span>
                <span className="hud-ear-pct">{a.pct}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="world-help">
        <span>
          Move with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys, or click a spot.
        </span>
        <span>Scroll to zoom.</span>
      </p>
    </div>
  )
}
