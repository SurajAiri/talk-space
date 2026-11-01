import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useRoomStore, type ChatMessage } from '../../store/room.store'
import Avatar from '../Avatar'
import { ChatIcon, LockIcon, SendIcon } from '../Icons'

const time = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Content of the chat panel: a recipient picker (everyone, or one person), the log, and the composer. */
export default function ChatWindow({
  to,
  onToChange,
  maxLength,
  autoFocus,
}: {
  /** 'all' or a person's id */
  to: string
  onToChange: (to: string) => void
  maxLength: number
  autoFocus?: boolean
}) {
  const allMessages = useRoomStore((s) => s.messages)
  const blocked = useRoomStore((s) => s.blocked)
  const peers = useRoomStore((s) => s.peers)
  const sendChat = useRoomStore((s) => s.sendChat)
  const messages = allMessages.filter((m) => m.self || !blocked[m.fromId])
  const peerList = Object.values(peers).filter((p) => !blocked[p.id])

  const [text, setText] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const target = to === 'all' ? undefined : peers[to]

  // the person we were writing to left: fall back to everyone rather than send into the void
  useEffect(() => {
    if (to !== 'all' && !peers[to]) onToChange('all')
  }, [to, peers, onToChange])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus, to])

  function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!text.trim()) return
    const result = sendChat(text, target?.id)
    setProblem(
      result === 'slow-down'
        ? 'Slow down a little.'
        : result === 'unreachable'
          ? `${target?.name ?? 'They'} can’t be reached right now.`
          : null,
    )
    if (result === 'sent') setText('')
  }

  return (
    <div className="chatw">
      <div className="chatw-log" ref={logRef} role="log" aria-live="polite" aria-label="Messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <ChatIcon size={26} />
            <p>
              {peerList.length === 0
                ? 'No one else is here yet. Messages go straight to the people in the room and nothing is stored.'
                : 'No messages yet. Say hello, or pick someone to message privately.'}
            </p>
          </div>
        ) : (
          messages.map((m) => <Message key={m.id} m={m} onReply={() => onToChange(m.fromId)} canReply={Boolean(peers[m.fromId])} />)
        )}
      </div>

      <form className="chatw-compose" onSubmit={onSubmit}>
        <div className="chatw-to">
          <label htmlFor="chat-to">To</label>
          <div className={`chatw-select ${target ? 'is-private' : ''}`}>
            {target ? <LockIcon size={14} /> : null}
            <select id="chat-to" value={to} onChange={(e) => onToChange(e.target.value)}>
              <option value="all">Everyone</option>
              {peerList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (private)
                </option>
              ))}
            </select>
          </div>
          {target && <span className="chatw-privnote">Only {target.name} will see this</span>}
        </div>
        <div className="chat-form">
          <input
            ref={inputRef}
            aria-label="Message"
            placeholder={target ? `Message ${target.name} privately` : 'Message everyone'}
            value={text}
            maxLength={maxLength}
            enterKeyHint="send"
            autoComplete="off"
            onChange={(e) => {
              setText(e.target.value)
              if (problem) setProblem(null)
            }}
          />
          <button type="submit" className="btn" disabled={!text.trim()} aria-label="Send message">
            <SendIcon size={17} />
          </button>
        </div>
        {problem && (
          <p className="hint is-warn-text" role="status">
            {problem}
          </p>
        )}
      </form>
    </div>
  )
}

function Message({ m, onReply, canReply }: { m: ChatMessage; onReply: () => void; canReply: boolean }) {
  return (
    <div className={`msg ${m.self ? 'msg-self' : ''} ${m.dm ? 'msg-dm' : ''}`}>
      {!m.self && <Avatar name={m.fromName} size={26} />}
      <div className="msg-main">
        <div className="msg-meta">
          <strong>{m.self ? (m.dm ? `You → ${m.toName ?? 'them'}` : 'You') : m.fromName}</strong>
          {m.dm && (
            <span className="msg-private">
              <LockIcon size={11} /> Private
            </span>
          )}
          <span>{time(m.ts)}</span>
          {!m.self && canReply && (
            <button type="button" className="msg-reply" onClick={onReply}>
              Reply privately
            </button>
          )}
        </div>
        <div className="msg-text">{m.text}</div>
      </div>
    </div>
  )
}
