/**
 * Decorative picture of how rooms work: you are the centre, and people fade out with distance.
 * The numbers match what the in-room panel shows ("Priya 92%").
 */
const PEOPLE = [
  { name: 'Priya', pct: '92%', x: 338, y: 178, hue: 262, on: true },
  { name: 'Diego', pct: '54%', x: 142, y: 282, hue: 150, on: true },
  { name: 'Hana', pct: '18%', x: 408, y: 338, hue: 18, on: true },
  { name: 'Leo', pct: 'out of earshot', x: 70, y: 96, hue: 212, on: false },
] as const

export default function EarshotDiagram() {
  const cx = 250
  const cy = 232
  return (
    <svg className="earshot" viewBox="0 0 500 440" role="img" aria-label="You, surrounded by rings. People inside a ring can hear you; the farther out they stand, the quieter they are.">
      <defs>
        <radialGradient id="earshot-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#3454f0" stopOpacity="0.38" />
          <stop offset="1" stopColor="#3454f0" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r="200" fill="url(#earshot-glow)" />
      <circle cx={cx} cy={cy} r="196" fill="none" stroke="#fff" strokeOpacity="0.1" strokeDasharray="3 7" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="132" fill="none" stroke="#fff" strokeOpacity="0.16" />
      <circle cx={cx} cy={cy} r="68" fill="none" stroke="#fff" strokeOpacity="0.26" />

      {/* a slow ripple leaving you, the one moving thing on the page */}
      <circle className="earshot-ripple" cx={cx} cy={cy} r="196" fill="none" stroke="#7d93ff" strokeWidth="1.5" />
      <circle className="earshot-ripple" cx={cx} cy={cy} r="196" fill="none" stroke="#7d93ff" strokeWidth="1.5" />

      {PEOPLE.map((p) => (
        <g key={p.name} opacity={p.on ? 1 : 0.5}>
          <circle cx={p.x} cy={p.y} r="14" fill={`oklch(0.86 0.09 ${p.hue})`} stroke="#0c1226" strokeWidth="3" />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={`oklch(0.32 0.1 ${p.hue})`}>
            {p.name[0]}
          </text>
          <g transform={`translate(${p.x + 20} ${p.y - 11})`}>
            <rect width={p.on ? 92 : 116} height="22" rx="11" fill="#0c1226" fillOpacity="0.88" stroke="#fff" strokeOpacity="0.14" />
            <text x="11" y="15" fontSize="11.5" fill="#fff" fontWeight="600">
              {p.on ? p.name : p.name}
            </text>
            <text x={p.on ? 81 : 105} y="15" fontSize="11.5" textAnchor="end" fill={p.on ? '#5ee0b0' : '#9aa6cc'} fontWeight="650">
              {p.on ? p.pct : ''}
            </text>
          </g>
          {!p.on && (
            <text x={p.x + 20} y={p.y + 26} fontSize="11" fill="#9aa6cc">
              {p.pct}
            </text>
          )}
        </g>
      ))}

      <circle cx={cx} cy={cy} r="20" fill="#3454f0" fillOpacity="0.35" />
      <circle cx={cx} cy={cy} r="11" fill="#fff" />
      <text x={cx} y={cy + 36} textAnchor="middle" fontSize="12" fontWeight="650" fill="#fff">
        You
      </text>
    </svg>
  )
}
