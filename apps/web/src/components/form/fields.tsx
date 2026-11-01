import {
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { passwordStrength } from '../../lib/validation'
import { AlertIcon, CheckIcon, EyeIcon, EyeOffIcon, XIcon } from '../Icons'

/* ------------------------------------------------------------------ shell */

interface ShellProps {
  id: string
  label: string
  optional?: boolean
  hint?: ReactNode
  /** the message to show when the field has been visited or the form was submitted */
  error?: string | null
  showError?: boolean
  counter?: { value: number; max: number }
  hideLabel?: boolean
  children: ReactNode
  className?: string
}

/** Label above, message below (a hint, or the error once there is one), optional counter. */
function Shell({ id, label, optional, hint, error, showError, counter, hideLabel, children, className = '' }: ShellProps) {
  const shown = showError && error ? error : null
  return (
    <div className={`ff ${shown ? 'has-error' : ''} ${className}`}>
      <label className={hideLabel ? 'ff-label sr-only' : 'ff-label'} htmlFor={id}>
        {label}
        {optional && <span className="ff-optional">Optional</span>}
      </label>
      {children}
      {(shown || hint || counter) && (
        <div className="ff-foot">
          <span id={`${id}-msg`} className={shown ? 'ff-msg is-error' : 'ff-msg'} role={shown ? 'alert' : undefined}>
            {shown && <AlertIcon size={14} />}
            {shown ?? hint}
          </span>
          {counter && (
            <span className={counter.value > counter.max * 0.9 ? 'ff-count is-near' : 'ff-count'}>
              {counter.value}/{counter.max}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ text */

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'size'> {
  label: string
  value: string
  onValueChange: (v: string) => void
  icon?: ReactNode
  hint?: ReactNode
  error?: string | null
  /** show the error right away (after a failed submit); otherwise it appears once the field is left */
  showError?: boolean
  /** a green tick when the value is good (only once there is something to judge) */
  valid?: boolean
  /** show "12/80" (needs maxLength) */
  counter?: boolean
  trailing?: ReactNode
  optional?: boolean
  /** a button that empties the field (search boxes) */
  clearable?: boolean
  /** keep the label for screen readers but don't draw it (compact toolbars) */
  hideLabel?: boolean
}

export function TextField({
  label,
  value,
  onValueChange,
  icon,
  hint,
  error,
  showError = false,
  valid,
  counter,
  trailing,
  optional,
  clearable,
  hideLabel,
  className,
  maxLength,
  onBlur,
  ...rest
}: TextFieldProps) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  const reveal = touched || showError
  const invalid = Boolean(reveal && error)
  return (
    <Shell
      id={id}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      showError={reveal}
      counter={counter && maxLength ? { value: value.length, max: maxLength } : undefined}
      hideLabel={hideLabel}
      className={className}
    >
      <div className={`ff-control ${invalid ? 'is-invalid' : ''} ${valid && !error && value ? 'is-valid' : ''}`}>
        {icon && <span className="ff-icon">{icon}</span>}
        <input
          {...rest}
          id={id}
          className="ff-input"
          value={value}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-msg`}
          onChange={(e) => onValueChange(e.target.value)}
          onBlur={(e) => {
            setTouched(true)
            onBlur?.(e)
          }}
        />
        {clearable && value && (
          <button type="button" className="ff-btn" aria-label="Clear" onClick={() => onValueChange('')}>
            <XIcon size={15} />
          </button>
        )}
        {valid && !error && value && !trailing && (
          <span className="ff-ok" aria-hidden="true">
            <CheckIcon size={16} />
          </span>
        )}
        {trailing}
      </div>
    </Shell>
  )
}

/* -------------------------------------------------------------- password */

export function PasswordField({
  meter,
  onKeyUp,
  ...props
}: Omit<TextFieldProps, 'type' | 'trailing'> & { meter?: boolean }) {
  const [shown, setShown] = useState(false)
  const [caps, setCaps] = useState(false)
  const strength = passwordStrength(props.value)
  return (
    <div className="ff-group">
      <TextField
        {...props}
        type={shown ? 'text' : 'password'}
        onKeyUp={(e: KeyboardEvent<HTMLInputElement>) => {
          setCaps(e.getModifierState?.('CapsLock') ?? false)
          onKeyUp?.(e)
        }}
        onBlur={(e) => {
          setCaps(false)
          props.onBlur?.(e)
        }}
        trailing={
          <button
            type="button"
            className="ff-btn"
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            onClick={() => setShown((v) => !v)}
          >
            {shown ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
          </button>
        }
      />
      {caps && (
        <p className="ff-note is-warn" role="status">
          <AlertIcon size={14} /> Caps Lock is on
        </p>
      )}
      {meter && props.value && (
        <div className="strength" data-score={strength.score}>
          <div className="strength-bars" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <i key={n} className={n <= strength.score ? 'on' : ''} />
            ))}
          </div>
          <span>{strength.label}</span>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- textarea */

export function TextArea({
  label,
  value,
  onValueChange,
  hint,
  error,
  showError = false,
  optional,
  maxLength,
  rows = 3,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  label: string
  value: string
  onValueChange: (v: string) => void
  hint?: ReactNode
  error?: string | null
  showError?: boolean
  optional?: boolean
}) {
  const id = useId()
  const [touched, setTouched] = useState(false)
  const reveal = touched || showError
  return (
    <Shell
      id={id}
      label={label}
      optional={optional}
      hint={hint}
      error={error}
      showError={reveal}
      counter={maxLength ? { value: value.length, max: maxLength } : undefined}
    >
      <div className={`ff-control ff-control-area ${reveal && error ? 'is-invalid' : ''}`}>
        <textarea
          {...rest}
          id={id}
          className="ff-input"
          rows={rows}
          value={value}
          maxLength={maxLength}
          aria-describedby={`${id}-msg`}
          onChange={(e) => onValueChange(e.target.value)}
          onBlur={() => setTouched(true)}
        />
      </div>
    </Shell>
  )
}

/* ---------------------------------------------------------------- select */

export function SelectField({
  label,
  value,
  onValueChange,
  icon,
  children,
  hint,
  hideLabel,
}: {
  label: string
  value: string
  onValueChange: (v: string) => void
  icon?: ReactNode
  children: ReactNode
  hint?: ReactNode
  hideLabel?: boolean
}) {
  const id = useId()
  return (
    <Shell id={id} label={label} hint={hint} hideLabel={hideLabel}>
      <div className="ff-control">
        {icon && <span className="ff-icon">{icon}</span>}
        <select id={id} className="ff-input ff-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
          {children}
        </select>
      </div>
    </Shell>
  )
}

/* ---------------------------------------------------------------- switch */

export function Switch({
  checked,
  onChange,
  children,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
  description?: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={`switch ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-text">
        <span className="switch-label">{children}</span>
        {description && <span className="switch-desc">{description}</span>}
      </span>
    </label>
  )
}

/* ------------------------------------------------------------- code input */

/**
 * A fixed-length code (room ID, join code) drawn as separate boxes. Underneath it is ONE ordinary
 * input, so pasting, autofill, the mobile keyboard and screen readers all behave as they should.
 */
export function CodeInput({
  label,
  length,
  mode,
  value,
  onValueChange,
  hint,
  autoFocus,
  autoComplete = 'off',
}: {
  label: string
  length: number
  mode: 'letters' | 'digits'
  value: string
  onValueChange: (v: string) => void
  hint?: ReactNode
  autoFocus?: boolean
  autoComplete?: string
}) {
  const id = useId()
  const ref = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const clean = (raw: string) =>
    (mode === 'letters' ? raw.replace(/[^a-zA-Z]/g, '').toUpperCase() : raw.replace(/\D/g, '')).slice(0, length)
  const active = Math.min(value.length, length - 1)
  return (
    <Shell id={id} label={label} hint={hint}>
      <div className={`code ${focused ? 'is-focused' : ''}`} onClick={() => ref.current?.focus()}>
        <input
          ref={ref}
          id={id}
          className="code-input"
          value={value}
          maxLength={length}
          inputMode={mode === 'digits' ? 'numeric' : 'text'}
          autoCapitalize="characters"
          autoComplete={autoComplete}
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          enterKeyHint="go"
          aria-describedby={`${id}-msg`}
          onChange={(e) => onValueChange(clean(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <div className="code-boxes" aria-hidden="true">
          {Array.from({ length }, (_, i) => (
            <span key={i} className={`code-box ${value[i] ? 'is-filled' : ''} ${focused && i === active ? 'is-active' : ''}`}>
              {value[i] ?? ''}
            </span>
          ))}
        </div>
      </div>
    </Shell>
  )
}

/* ------------------------------------------------------------- tag input */

export function TagInput({
  label,
  tags,
  onTagsChange,
  normalize,
  validate,
  max,
  placeholder,
  hint,
  optional,
}: {
  label: string
  tags: string[]
  onTagsChange: (t: string[]) => void
  normalize: (raw: string) => string
  /** returns a message when the tag is not acceptable */
  validate: (tag: string) => string | null
  max: number
  placeholder?: string
  hint?: ReactNode
  optional?: boolean
}) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  const full = tags.length >= max

  function commit(raw: string) {
    const tag = normalize(raw)
    if (!tag) return setDraft('')
    if (tags.includes(tag)) {
      setDraft('')
      return setError(null)
    }
    const problem = validate(tag)
    if (problem) return setError(problem)
    if (full) return setError(`At most ${max} tags`)
    onTagsChange([...tags, tag])
    setDraft('')
    setError(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault() // Enter here adds a tag; it must not submit the surrounding form
      commit(draft)
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      onTagsChange(tags.slice(0, -1))
    }
  }

  return (
    <Shell id={id} label={label} optional={optional} hint={hint ?? `Press Enter or comma to add. Up to ${max}.`} error={error} showError>
      <div className={`ff-control ff-tags ${error ? 'is-invalid' : ''}`} onClick={() => ref.current?.focus()}>
        {tags.map((t) => (
          <span className="tag-pill" key={t}>
            #{t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onTagsChange(tags.filter((x) => x !== t))}>
              <XIcon size={12} />
            </button>
          </span>
        ))}
        <input
          ref={ref}
          id={id}
          className="ff-input tag-draft"
          value={draft}
          disabled={full}
          placeholder={full ? '' : tags.length ? 'Add another' : placeholder}
          enterKeyHint="done"
          autoCapitalize="none"
          aria-describedby={`${id}-msg`}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft && commit(draft)}
        />
      </div>
    </Shell>
  )
}
