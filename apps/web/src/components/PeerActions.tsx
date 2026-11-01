import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { REPORT_REASONS } from '../lib/rooms'
import { useAuthStore } from '../store/auth.store'
import { useRoomStore } from '../store/room.store'
import { TextArea } from './form/fields'
import { BanIcon, ChatIcon, FlagIcon, XIcon } from './Icons'

/** Block / report / (host) remove, for one other person in the room. */
export default function PeerActions({ peerId, name, onMessage }: { peerId: string; name: string; onMessage?: () => void }) {
  const selfId = useAuthStore((s) => s.user?.id)
  const hostId = useRoomStore((s) => s.room?.createdBy)
  const isBlocked = useRoomStore((s) => Boolean(s.blocked[peerId]))
  const blockPeer = useRoomStore((s) => s.blockPeer)
  const unblockPeer = useRoomStore((s) => s.unblockPeer)
  const kickPeer = useRoomStore((s) => s.kickPeer)
  const reportPeer = useRoomStore((s) => s.reportPeer)

  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState(REPORT_REASONS[0]!.value)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const iAmHost = Boolean(selfId && hostId === selfId)
  const reportRef = useRef<HTMLDivElement>(null)
  // the form opens inside a scrolling list: make sure all of it is in view
  useEffect(() => {
    if (reporting) reportRef.current?.scrollIntoView({ block: 'nearest' })
  }, [reporting])

  async function onReport() {
    setBusy(true)
    const res = await reportPeer(peerId, reason, details)
    setBusy(false)
    if (res.ok) {
      toast.success('Report sent. Thank you.')
      setReporting(false)
      setDetails('')
    } else {
      toast.error(res.message)
    }
  }

  async function onKick() {
    if (!window.confirm(`Remove ${name} from this room? They won't be able to rejoin.`)) return
    const res = await kickPeer(peerId)
    if (!res.ok) toast.error(res.message ?? 'Could not remove them.')
  }

  return (
    <>
      <div className="peer-actions">
        {onMessage && !isBlocked && (
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-small"
            aria-label={`Message ${name} privately`}
            title="Message privately"
            onClick={onMessage}
          >
            <ChatIcon size={16} />
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-small"
          aria-pressed={isBlocked}
          aria-label={isBlocked ? `Unblock ${name}` : `Block ${name}`}
          title={isBlocked ? 'Unblock' : 'Block: stop hearing them'}
          onClick={() => (isBlocked ? unblockPeer(peerId) : blockPeer(peerId))}
        >
          <BanIcon size={16} />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-small"
          aria-pressed={reporting}
          aria-label={`Report ${name}`}
          title="Report"
          onClick={() => setReporting((v) => !v)}
        >
          <FlagIcon size={16} />
        </button>
        {iAmHost && (
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-small btn-quiet-danger"
            aria-label={`Remove ${name} from the room`}
            title="Remove from room"
            onClick={() => void onKick()}
          >
            <XIcon size={16} />
          </button>
        )}
      </div>
      {reporting && (
        <div className="peer-report" ref={reportRef}>
          <div className="reasons" role="radiogroup" aria-label="Reason">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reason === r.value}
                className={reason === r.value ? 'reason is-on' : 'reason'}
                onClick={() => setReason(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <TextArea label="Details" optional rows={2} maxLength={500} value={details} onValueChange={setDetails} />
          <p className="hint">Their latest message here is attached so a moderator has context.</p>
          <div className="peer-report-actions">
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setReporting(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-small" disabled={busy} onClick={() => void onReport()}>
              {busy ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
