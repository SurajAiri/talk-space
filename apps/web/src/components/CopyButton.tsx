import { useState } from 'react'
import { CheckIcon, CopyIcon } from './Icons'

export default function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable (insecure context) */
    }
  }

  return (
    <button type="button" className={copied ? 'copy is-copied' : 'copy'} onClick={copy} title={`Copy ${label}`}>
      <span className="copy-label">{label}</span>
      <code>{value}</code>
      <span className="copy-state" aria-live="polite">
        {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
        <span className="sr-only">{copied ? 'Copied' : 'Copy'}</span>
      </span>
    </button>
  )
}
