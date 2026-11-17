import { useEffect, useRef, useState } from 'react'
import { EMOTES, REACTIONS } from '../../world/fx'
import type { WorldSession } from '../../world/WorldSession'
import { SmileIcon } from '../Icons'

type Tab = 'emotes' | 'reactions' | 'words'

const TABS: { id: Tab; label: string }[] = [
  { id: 'emotes', label: 'Emotes' },
  { id: 'reactions', label: 'Reactions' },
  { id: 'words', label: 'Big words' },
]

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  return Boolean(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))
}

/**
 * Make your character do something: a dance or a wave, an emoji, or a word in big animated letters.
 * Everything here is a fixed list (world/fx.ts); picking one plays it on you and tells the room. Press E to open.
 * It renders as a top-bar button (a thumb button on phones) with its panel hanging off it: below on a laptop, above on a phone.
 */
export default function ReactionDock({ session }: { session: WorldSession }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('emotes')
  const wrap = useRef<HTMLDivElement>(null)
  const firstItem = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setOpen(false)
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !isTyping(e)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {
    if (open) firstItem.current?.focus({ preventScroll: true })
  }, [open, tab])

  const pick = (fn: () => boolean) => {
    // too soon after the last one: keep the panel open so the tap is not lost, the cooldown is under half a second
    if (fn()) setOpen(false)
  }

  return (
    <div className="rdock" ref={wrap}>
      <button type="button" className={`rbtn rbtn-react ${open ? 'is-on' : ''}`} aria-expanded={open} aria-haspopup="dialog" aria-label="Emotes and reactions" title="Emotes and reactions (E)" onClick={() => setOpen((v) => !v)}>
        <SmileIcon size={19} />
        <span className="rbtn-label">React</span>
      </button>
      {open && (
        <div className="rdock-panel" role="dialog" aria-label="Emotes and reactions">
          <div className="rdock-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="rdock-tab" onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="rdock-grid" role="tabpanel">
            {tab === 'emotes' &&
              EMOTES.map((e, i) => (
                <button key={e.id} ref={i === 0 ? firstItem : undefined} type="button" className="rdock-item rdock-emote" onClick={() => pick(() => session.playEmote(e.id))}>
                  <span className="rdock-emoji" aria-hidden="true">
                    {e.emoji}
                  </span>
                  {e.label}
                </button>
              ))}
            {tab === 'reactions' &&
              REACTIONS.filter((r) => r.kind === 'emoji').map((r, i) => (
                <button key={r.id} ref={i === 0 ? firstItem : undefined} type="button" className="rdock-item rdock-react" aria-label={r.label} title={r.label} onClick={() => pick(() => session.sendReaction(r.id))}>
                  <span className="rdock-emoji" aria-hidden="true">
                    {r.text}
                  </span>
                </button>
              ))}
            {tab === 'words' &&
              REACTIONS.filter((r) => r.kind === 'text').map((r, i) => (
                <button key={r.id} ref={i === 0 ? firstItem : undefined} type="button" className="rdock-item rdock-word" onClick={() => pick(() => session.sendReaction(r.id))}>
                  <span className={r.style === 'rainbow' ? 'rdock-rainbow' : undefined} style={r.style === 'rainbow' ? undefined : { color: r.color }}>
                    {r.text}
                  </span>
                </button>
              ))}
          </div>
          <p className="rdock-hint">Walking stops an emote. Everyone nearby sees these.</p>
        </div>
      )}
    </div>
  )
}
