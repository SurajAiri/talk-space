import { enterImmersive, fullscreenSupported } from '../../lib/fullscreen'
import { PhoneOffIcon } from '../Icons'

/** Phones held upright: the map needs the width, so ask for it instead of drawing a sliver. */
export default function RotatePrompt({ onLeave }: { onLeave: () => void }) {
  return (
    <div className="rotate" role="alertdialog" aria-labelledby="rotate-title">
      <div className="rotate-card">
        <svg className="rotate-art" viewBox="0 0 120 120" aria-hidden="true">
          <g className="rotate-phone">
            <rect x="42" y="18" width="36" height="68" rx="7" fill="none" stroke="currentColor" strokeWidth="3.5" />
            <circle cx="60" cy="76" r="2.5" fill="currentColor" />
            <rect x="52" y="24" width="16" height="3" rx="1.5" fill="currentColor" opacity="0.5" />
          </g>
          <path d="M22 96a44 44 0 0 0 76 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" opacity="0.7" />
          <path d="m96 86 4 10-11 1" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </svg>
        <h2 id="rotate-title">Turn your phone sideways</h2>
        <p>The room is a map you walk around, and it needs the width. Your voice and chat keep working meanwhile.</p>
        <div className="stack">
          {fullscreenSupported() && (
            <button type="button" className="btn btn-lg btn-block" onClick={() => void enterImmersive(true)}>
              Go full screen
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-block" onClick={onLeave}>
            <PhoneOffIcon size={17} />
            Leave room
          </button>
        </div>
      </div>
    </div>
  )
}
