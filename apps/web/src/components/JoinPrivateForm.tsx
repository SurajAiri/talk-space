import { useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router'
import type { RoomConfig } from '../lib/rooms'

export default function JoinPrivateForm({ config }: { config: RoomConfig | null }) {
  const navigate = useNavigate()
  const idLength = config?.idLength ?? 6
  const codeLength = config?.joinCodeLength ?? 6
  const [roomId, setRoomId] = useState('')
  const [code, setCode] = useState('')
  const ready = roomId.length === idLength && code.length === codeLength

  function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (ready) navigate(`/room/${roomId}`, { state: { joinCode: code } })
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <input
        aria-label="Room ID"
        placeholder={`Room ID (${idLength} letters)`}
        value={roomId}
        maxLength={idLength}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setRoomId(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
      />
      <input
        aria-label="Join code"
        placeholder={`Join code (${codeLength} digits)`}
        value={code}
        maxLength={codeLength}
        inputMode="numeric"
        autoComplete="off"
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
      <button type="submit" className="btn" disabled={!ready}>
        Join private room
      </button>
    </form>
  )
}
