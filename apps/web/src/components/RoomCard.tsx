import { labelFor, type RoomConfig, type RoomView } from '../lib/rooms'
import { loadWorldMap } from '../world/maps'
import { GlobeIcon, MapIcon } from './Icons'
import MapThumb from './MapThumb'

interface Props {
  room: RoomView
  config: RoomConfig | null
  onJoin: (room: RoomView) => void
}

export default function RoomCard({ room, config, onJoin }: Props) {
  const full = room.participantCount >= room.maxMembers
  const pct = Math.min(100, Math.round((room.participantCount / room.maxMembers) * 100))
  return (
    <li className="room-card">
      <div className="room-thumb">
        <MapThumb mapKey={room.map} />
      </div>
      <div className="room-card-main">
        <h3>{room.title}</h3>
        {room.shortDescription && <p className="room-desc">{room.shortDescription}</p>}
        <div className="chips">
          <span className="chip">
            <GlobeIcon size={13} />
            {labelFor(config?.languages, room.language)}
          </span>
          <span className="chip chip-neutral">{labelFor(config?.purposes, room.purpose)}</span>
          {room.map && (
            <span className="chip chip-neutral">
              <MapIcon size={13} />
              {loadWorldMap(room.map)?.title ?? room.map}
            </span>
          )}
        </div>
        {room.tags.length > 0 && (
          <div className="chips room-tags">
            {room.tags.map((t) => (
              <span key={t} className="chip chip-tag">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="room-card-side">
        <div className={full ? 'occupancy is-full' : 'occupancy'} aria-label={`${room.participantCount} of ${room.maxMembers} people`}>
          <span>
            {room.participantCount} of {room.maxMembers} here
          </span>
          <span className="occupancy-bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </span>
        </div>
        <button type="button" className="btn btn-outline join-btn" disabled={full} onClick={() => onJoin(room)} aria-label={`Join ${room.title}`}>
          {full ? 'Full' : 'Join'}
        </button>
      </div>
    </li>
  )
}
