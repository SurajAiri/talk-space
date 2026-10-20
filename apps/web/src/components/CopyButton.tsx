import { useState } from 'react'

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
    <button type="button" className="copy" onClick={copy} title={`Copy ${label}`}>
      <span className="copy-label">{label}</span>
      <code>{value}</code>
      <span className="copy-state" aria-live="polite">
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  )
}
