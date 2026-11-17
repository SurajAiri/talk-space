import { useRoomStore } from '../../store/room.store'
import { MicIcon, MicOffIcon } from '../Icons'

/**
 * Microphone: green when others can hear you, red when you've muted, plain when it was never turned on
 * (a tap then asks the browser for the microphone). The state is also in the label, never colour alone.
 */
export function MicButton() {
  const mic = useRoomStore((s) => s.mic)
  const muted = useRoomStore((s) => s.muted)
  const toggleMute = useRoomStore((s) => s.toggleMute)
  const enableMic = useRoomStore((s) => s.enableMic)

  const on = mic === 'on'
  const label = !on ? 'Turn on microphone' : muted ? 'Unmute microphone' : 'Mute microphone'
  return (
    <button
      type="button"
      className={`rbtn rbtn-icon ${on ? (muted ? 'is-muted' : 'is-live') : 'is-off'}`}
      aria-label={label}
      aria-pressed={on ? !muted : undefined}
      title={label}
      onClick={() => (on ? toggleMute() : void enableMic())}
    >
      {on && !muted ? <MicIcon size={20} /> : <MicOffIcon size={20} />}
    </button>
  )
}
