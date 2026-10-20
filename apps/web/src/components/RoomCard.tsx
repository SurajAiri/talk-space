import { labelFor, type RoomConfig, type RoomView } from '../lib/rooms'

interface Props {
  room: RoomView
  config: RoomConfig | null
  onJoin: (room: RoomView) => void
}

export default function RoomCard({ room, config, onJoin }: Props) {
  const full = room.participantCount >= room.maxMembers
  return (
    <li className="room-card">
      <div className="room-card-main">
        <h3>{room.title}</h3>
        {room.shortDescription && <p className="muted-left">{room.shortDescription}</p>}
        <div className="chips">
          <span className="chip">{labelFor(config?.languages, room.language)}</span>
          <span className="chip">{labelFor(config?.purposes, room.purpose)}</span>
          {room.tags.map((t) => (
            <span key={t} className="chip chip-tag">
              #{t}
            </span>
          ))}
        </div>
      </div>
      <div className="room-card-side">
        <span className={full ? 'count count-full' : 'count'}>
          {room.participantCount}/{room.maxMembers}
        </span>
        <button type="button" className="btn" disabled={full} onClick={() => onJoin(room)}>
          {full ? 'Full' : 'Join'}
        </button>
      </div>
    </li>
  )
}
