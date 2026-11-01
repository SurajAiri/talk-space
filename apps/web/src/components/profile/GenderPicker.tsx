import { useId, type ReactNode } from 'react'
import type { Gender } from '../../lib/api'
import { AlertIcon, CheckIcon, EyeOffIcon, MarsIcon, NonBinaryIcon, VenusIcon } from '../Icons'

const ICONS: Record<Gender, ReactNode> = {
  female: <VenusIcon size={20} />,
  male: <MarsIcon size={20} />,
  non_binary: <NonBinaryIcon size={20} />,
  prefer_not_to_say: <EyeOffIcon size={20} />,
}

interface Props {
  options: { value: Gender; label: string }[]
  value: Gender | null
  onChange: (v: Gender) => void
  error?: string | null
  showError?: boolean
  legend?: string
}

/** One choice out of a few, as big tappable cards. A group of real radio buttons underneath. */
export default function GenderPicker({ options, value, onChange, error, showError, legend = 'How do you identify?' }: Props) {
  const name = useId()
  const problem = showError && error ? error : null
  return (
    <fieldset className="cp">
      <legend className="cp-legend">
        <span className="cp-title">{legend}</span>
      </legend>
      <div className="gender-grid">
        {options.map((o) => (
          <label key={o.value} className="gopt">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="gopt-icon">{ICONS[o.value]}</span>
            <span className="gopt-label">{o.label}</span>
            <span className="gopt-check" aria-hidden="true">
              <CheckIcon size={13} strokeWidth={2.8} />
            </span>
          </label>
        ))}
      </div>
      {problem && (
        <span className="ff-msg is-error" role="alert">
          <AlertIcon size={14} />
          {problem}
        </span>
      )}
    </fieldset>
  )
}
