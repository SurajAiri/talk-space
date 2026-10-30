import { useState } from 'react'
import { toast } from 'sonner'
import { REPORT_REASONS } from '../lib/rooms'
import { useAuthStore } from '../store/auth.store'
import { useRoomStore } from '../store/room.store'

/** Block / report / (host) remove, for one other person in the room. */
export default function PeerActions({ peerId, name }: { peerId: string; name: string }) {
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
    <div className="peer-actions">
      <button
        type="button"
        className="btn btn-outline btn-small"
        onClick={() => (isBlocked ? unblockPeer(peerId) : blockPeer(peerId))}
      >
        {isBlocked ? 'Unblock' : 'Block'}
      </button>
      <button type="button" className="btn btn-outline btn-small" onClick={() => setReporting((v) => !v)}>
        Report
      </button>
      {iAmHost && (
        <button type="button" className="btn btn-danger btn-small" onClick={() => void onKick()}>
          Remove
        </button>
      )}
      {reporting && (
        <div className="peer-report">
          <select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Details (optional)"
            placeholder="Details (optional)"
            maxLength={500}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <p className="hint">Their latest message here is attached so a moderator has context.</p>
          <button type="button" className="btn btn-small" disabled={busy} onClick={() => void onReport()}>
            {busy ? 'Sending…' : 'Send report'}
          </button>
        </div>
      )}
    </div>
  )
}
