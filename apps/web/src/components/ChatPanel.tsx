import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useRoomStore } from '../store/room.store'
import { SendIcon, UsersIcon } from './Icons'

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function ChatPanel({ maxLength }: { maxLength: number }) {
  const allMessages = useRoomStore((s) => s.messages)
  const blocked = useRoomStore((s) => s.blocked)
  const messages = allMessages.filter((m) => m.self || !blocked[m.fromId])
  const peerCount = useRoomStore((s) => Object.keys(s.peers).length)
  const sendChat = useRoomStore((s) => s.sendChat)
  const [text, setText] = useState('')
  const [slow, setSlow] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const result = sendChat(text)
    setSlow(result === 'slow-down')
    if (result === 'sent') setText('')
  }

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef} role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <UsersIcon size={28} />
            <p>
              {peerCount === 0
                ? 'Waiting for others to join. Messages go straight to them, and nothing is stored.'
                : 'No messages yet. Messages go straight to the others in this room.'}
            </p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.self ? 'msg msg-self' : 'msg'}>
            <div className="msg-meta">
              <strong>{m.fromName}</strong> <span>{time(m.ts)}</span>
            </div>
            <div className="msg-text">{m.text}</div>
          </div>
        ))}
      </div>
      {slow && (
        <p className="hint" role="status">
          You&apos;re sending messages too fast. Wait a moment.
        </p>
      )}
      <form className="chat-form" onSubmit={onSubmit}>
        <input
          aria-label="Message"
          placeholder="Write a message"
          value={text}
          maxLength={maxLength}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn" disabled={!text.trim()} aria-label="Send message">
          <SendIcon size={17} />
        </button>
      </form>
    </div>
  )
}
