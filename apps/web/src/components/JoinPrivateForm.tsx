import { useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router'
import type { RoomConfig } from '../lib/rooms'
import { CodeInput } from './form/fields'

export default function JoinPrivateForm({ config }: { config: RoomConfig | null }) {
  const navigate = useNavigate()
  const idLength = config?.idLength ?? 6
  const codeLength = config?.joinCodeLength ?? 8
  const [roomId, setRoomId] = useState('')
  const [code, setCode] = useState('')
  const ready = roomId.length === idLength && code.length === codeLength

  function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (ready) navigate(`/room/${roomId}`, { state: { joinCode: code } })
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <CodeInput label="Room ID" length={idLength} mode="letters" value={roomId} onValueChange={setRoomId} hint={`${idLength} letters`} />
      <CodeInput label="Join code" length={codeLength} mode="digits" value={code} onValueChange={setCode} hint={`${codeLength} digits`} />
      <button type="submit" className="btn btn-block" disabled={!ready}>
        Join private room
      </button>
    </form>
  )
}
