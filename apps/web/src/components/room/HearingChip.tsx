import { useEffect, useState } from 'react'
import { useRoomStore } from '../../store/room.store'
import type { HudSnapshot, WorldSession } from '../../world/WorldSession'
import Avatar from '../Avatar'
import { UsersIcon, VolumeIcon } from '../Icons'

/** One line on who can hear you right now. Replaces the old panel that covered a corner of the map. */
export default function HearingChip({ session, onClick }: { session: WorldSession; onClick: () => void }) {
  const [hud, setHud] = useState<HudSnapshot>({ zoneName: null, hearing: {} })
  const peers = useRoomStore((s) => s.peers)
  useEffect(() => session.subscribe(setHud), [session])

  const audible = Object.entries(hud.hearing)
    .map(([id, g]) => ({ id, name: peers[id]?.name ?? 'Someone', pct: Math.round(g * 100) }))
    .filter((a) => a.pct > 0)
    .sort((a, b) => b.pct - a.pct)
  const total = Object.keys(hud.hearing).length
  const sub =
    total === 0 ? 'You’re the only one here' : audible.length === 0 ? 'No one in earshot' : `${audible.length} in earshot`

  return (
    <button type="button" className="hearing" onClick={onClick} title="Who can hear you. Open the people list.">
      <span className={`hearing-icon ${audible.length ? 'is-on' : ''}`}>{hud.zoneName ? <VolumeIcon size={17} /> : <UsersIcon size={17} />}</span>
      <span className="hearing-text">
        <span className="hearing-title">{hud.zoneName ?? 'Open area'}</span>
        <span className="hearing-sub">{sub}</span>
      </span>
      {audible.length > 0 && (
        <span className="hearing-stack" aria-hidden="true">
          {audible.slice(0, 3).map((a) => (
            <Avatar key={a.id} name={a.name} size={24} />
          ))}
        </span>
      )}
    </button>
  )
}
