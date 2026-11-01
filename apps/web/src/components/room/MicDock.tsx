import { useRoomStore } from '../../store/room.store'
import { MicIcon, MicOffIcon } from '../Icons'

const NOTE: Partial<Record<string, string>> = {
  denied: 'Microphone is blocked. Allow it in your browser’s site settings.',
  unavailable: 'No working microphone was found.',
  unsupported: 'The microphone needs HTTPS (or localhost).',
}

/** The one control you reach for constantly: big, centred, and its colour says the state. */
export default function MicDock() {
  const mic = useRoomStore((s) => s.mic)
  const muted = useRoomStore((s) => s.muted)
  const toggleMute = useRoomStore((s) => s.toggleMute)
  const enableMic = useRoomStore((s) => s.enableMic)

  if (mic !== 'on') {
    return (
      <div className="micdock">
        <button type="button" className="mic mic-off" onClick={() => void enableMic()}>
          <MicIcon size={22} />
          <span className="mic-label">Turn on mic</span>
        </button>
        {NOTE[mic] && <p className="micdock-note">{NOTE[mic]}</p>}
      </div>
    )
  }
  return (
    <div className="micdock">
      <button type="button" className={`mic ${muted ? 'is-muted' : 'is-live'}`} onClick={toggleMute} aria-pressed={!muted}>
        {muted ? <MicOffIcon size={22} /> : <MicIcon size={22} />}
        <span className="mic-label">{muted ? 'Unmute' : 'Mic on'}</span>
      </button>
    </div>
  )
}
