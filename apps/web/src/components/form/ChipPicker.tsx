import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { normalizeLabel, validateLabel } from '../../lib/validation'
import { AlertIcon, CheckIcon, ChevronDownIcon, PlusIcon, SearchIcon, XIcon } from '../Icons'

export interface ChipOption {
  value: string
  label: string
}

interface Props {
  label: string
  hint?: ReactNode
  icon?: ReactNode
  /** the things on offer: suggestions, or a fixed list such as languages */
  options: ChipOption[]
  /** values of the chosen options (and any the person typed themselves) */
  selected: string[]
  onChange: (next: string[]) => void
  max: number
  /** show a search box (long lists such as languages) */
  searchLabel?: string
  /** let people type their own; the numbers are the length limits */
  custom?: { min: number; max: number; placeholder: string }
  /** only this many are shown until "Show more" is pressed (a search shows everything that matches) */
  initiallyVisible?: number
  error?: string | null
  showError?: boolean
  /** what to call the items, for messages: "language", "interest" */
  noun: string
}

/**
 * Pick several things by tapping them. Every chip is a real checkbox underneath, so the keyboard
 * (Tab, Space) and screen readers work as they should.
 */
export default function ChipPicker({
  label,
  hint,
  icon,
  options,
  selected,
  onChange,
  max,
  searchLabel,
  custom,
  initiallyVisible,
  error,
  showError,
  noun,
}: Props) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)

  const full = selected.length >= max
  const searching = query.trim().length > 0

  // Things the person typed themselves are not in `options`, but they must show up (and be removable).
  const shown = useMemo(() => {
    const known = new Set(options.map((o) => o.value))
    const own = selected.filter((v) => !known.has(v)).map((v) => ({ value: v, label: v }))
    let list = [...options, ...own]
    if (searching) {
      const q = query.trim().toLocaleLowerCase()
      return list.filter((o) => o.label.toLocaleLowerCase().includes(q))
    }
    if (initiallyVisible && !expanded && options.length > initiallyVisible) {
      // keep whatever is chosen visible, even when it lives in the part that is folded away
      const first = new Set(options.slice(0, initiallyVisible).map((o) => o.value))
      list = list.filter((o) => first.has(o.value) || selected.includes(o.value))
    }
    return list
  }, [options, selected, query, searching, expanded, initiallyVisible])

  const hidden = initiallyVisible && !searching && !expanded ? options.length - initiallyVisible : 0

  function toggle(value: string, on: boolean) {
    if (on) {
      if (!full) onChange([...selected, value])
    } else onChange(selected.filter((v) => v !== value))
  }

  function commitDraft() {
    if (!custom) return
    const text = normalizeLabel(draft)
    if (!text) return setDraft('')
    // typing "music" when "Music" is already there just selects it
    const existing = [...options.map((o) => o.value), ...selected].find((v) => v.toLocaleLowerCase() === text.toLocaleLowerCase())
    if (existing) {
      if (!selected.includes(existing)) {
        if (full) return setDraftError(`Up to ${max} ${noun}s`)
        onChange([...selected, existing])
      }
      setDraft('')
      return setDraftError(null)
    }
    const problem = validateLabel(text, custom.min, custom.max)
    if (problem) return setDraftError(problem)
    if (full) return setDraftError(`Up to ${max} ${noun}s`)
    onChange([...selected, text])
    setDraft('')
    setDraftError(null)
  }

  function onDraftKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault() // Enter here adds a chip; it must not submit the surrounding form
      commitDraft()
    }
  }

  const problem = showError && error ? error : null

  return (
    <fieldset className={`cp ${problem ? 'has-error' : ''}`} aria-describedby={`${id}-msg`}>
      <legend className="cp-legend">
        <span className="cp-title">
          {icon}
          {label}
        </span>
        <span className={`cp-count ${full ? 'is-full' : ''}`} aria-live="polite">
          {selected.length}/{max}
        </span>
      </legend>

      {searchLabel && (
        <div className="ff-control cp-search">
          <span className="ff-icon">
            <SearchIcon size={17} />
          </span>
          <input
            className="ff-input"
            type="search"
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={query}
            enterKeyHint="search"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          />
          {query && (
            <button type="button" className="ff-btn" aria-label="Clear search" onClick={() => setQuery('')}>
              <XIcon size={15} />
            </button>
          )}
        </div>
      )}

      <div className="cp-chips">
        {shown.map((o) => {
          const on = selected.includes(o.value)
          return (
            <label key={o.value} className={`cp-chip ${on ? 'is-on' : ''} ${!on && full ? 'is-disabled' : ''}`}>
              <input type="checkbox" checked={on} disabled={!on && full} onChange={(e) => toggle(o.value, e.target.checked)} />
              <span className="cp-chip-tick" aria-hidden="true">
                <CheckIcon size={12} strokeWidth={3} />
              </span>
              {o.label}
            </label>
          )
        })}
        {shown.length === 0 && <p className="cp-empty">No {noun} matches “{query.trim()}”.</p>}
      </div>

      {hidden > 0 && (
        <button type="button" className="cp-more" onClick={() => setExpanded(true)}>
          <ChevronDownIcon size={15} />
          Show {hidden} more
        </button>
      )}

      {custom && (
        <div className="cp-add">
          <div className={`ff-control ${draftError ? 'is-invalid' : ''}`}>
            <span className="ff-icon">
              <PlusIcon size={17} />
            </span>
            <input
              className="ff-input"
              aria-label={`Add your own ${noun}`}
              placeholder={custom.placeholder}
              value={draft}
              maxLength={custom.max + 10}
              enterKeyHint="done"
              autoComplete="off"
              aria-invalid={draftError ? true : undefined}
              onChange={(e) => {
                setDraft(e.target.value)
                if (draftError) setDraftError(null)
              }}
              onKeyDown={onDraftKey}
            />
            <button type="button" className="btn btn-small btn-outline cp-add-btn" disabled={!draft.trim()} onClick={commitDraft}>
              Add
            </button>
          </div>
          {draftError && (
            <span className="ff-msg is-error" role="alert">
              <AlertIcon size={14} />
              {draftError}
            </span>
          )}
        </div>
      )}

      <span id={`${id}-msg`} className={problem ? 'ff-msg is-error' : 'ff-msg'} role={problem ? 'alert' : undefined}>
        {problem && <AlertIcon size={14} />}
        {problem ?? hint}
      </span>
    </fieldset>
  )
}
