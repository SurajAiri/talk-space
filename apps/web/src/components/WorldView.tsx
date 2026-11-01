import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/auth.store'
import { useRoomStore } from '../store/room.store'
import { WorldEngine } from '../world/WorldEngine'
import type { WorldSession } from '../world/WorldSession'

/** The map, edge to edge. Everything a person reads or presses is laid over it by the room page. */
export default function WorldView({ session }: { session: WorldSession }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // the id this person has *in the room*: bubbles and remote positions are keyed by it too
  const selfId = useRoomStore((s) => s.selfId)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !selfId) return
    const engine = new WorldEngine({
      canvas,
      session,
      selfId,
      // read every frame, outside React: the engine must not re-render the page
      getSelf: () => ({ name: useAuthStore.getState().user?.name ?? 'You', muted: useRoomStore.getState().muted }),
      getPeers: () => useRoomStore.getState().peers,
    })
    engine.start()
    return () => engine.destroy()
  }, [session, selfId])

  return <canvas ref={canvasRef} className="world-canvas" aria-label="Room map. Move with the arrow keys, WASD, the joystick or by tapping." />
}
