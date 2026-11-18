import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/auth.store'
import { useRoomStore } from '../store/room.store'
import { WorldEngine } from '../world/WorldEngine'
import type { MenuAnchor } from '../lib/menuAnchor'
import CharacterMenu from './room/CharacterMenu'
import type { WorldSession } from '../world/WorldSession'

/** The map, edge to edge. Everything a person reads or presses is laid over it by the room page. */
export default function WorldView({ session, onMessage }: { session: WorldSession; onMessage?: (peerId: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** the person whose menu is open (clicked or tapped in the world) */
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
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
      getSelf: () => {
        const user = useAuthStore.getState().user
        return { name: user?.name ?? 'You', muted: useRoomStore.getState().muted, avatar: user?.avatar }
      },
      getPeers: () => useRoomStore.getState().peers,
      onCharacterClick: (id, x, y) => setMenu({ id, x, y }),
    })
    engine.start()
    return () => engine.destroy()
  }, [session, selfId])

  return (
    <>
      <canvas ref={canvasRef} className="world-canvas" aria-label="Room map. Move with the arrow keys, WASD, the joystick or by tapping. Click a person for actions, such as asking to follow them." />
      {menu && <CharacterMenu key={menu.id} anchor={menu} session={session} onClose={closeMenu} onMessage={onMessage} />}
    </>
  )
}
