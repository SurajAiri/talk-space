import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useRoomStore } from '../store/room.store'

const time = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function ChatPanel({ maxLength }: { maxLength: number }) {
  const messages = useRoomStore((s) => s.messages)
  const peerCount = useRoomStore((s) => Object.keys(s.peers).length)
  const sendChat = useRoomStore((s) => s.sendChat)
  const [text, setText] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sendChat(text)) setText('')
  }

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef} role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="muted-left">
            {peerCount === 0
              ? 'Waiting for others to join. Messages go straight to them, and nothing is stored.'
              : 'No messages yet. Messages go straight to the others in this room.'}
          </p>
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
      <form className="chat-form" onSubmit={onSubmit}>
        <input
          aria-label="Message"
          placeholder="Write a message"
          value={text}
          maxLength={maxLength}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn" disabled={!text.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
