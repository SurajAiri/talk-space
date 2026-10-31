/** Initials on a colour that is stable for the same name, so a person looks the same everywhere. */
const HUES = [212, 262, 330, 18, 150, 190, 38, 292]

function hueFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]!
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]![0] ?? '?'
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : ''
  return (first + last).toUpperCase()
}

export default function Avatar({ name, size = 32, status }: { name: string; size?: number; status?: 'live' | 'warn' | 'bad' | 'idle' }) {
  const hue = hueFor(name)
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        ['--h' as string]: hue,
      }}
      aria-hidden="true"
    >
      {initials(name)}
      {status && <span className={`avatar-status avatar-status-${status}`} />}
    </span>
  )
}
