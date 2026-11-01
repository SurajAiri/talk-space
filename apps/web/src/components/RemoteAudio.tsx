import { useEffect, useRef } from 'react'

/** Plays one peer's audio. Rendered invisibly; the stream is live-updated by WebRTC. */
export default function RemoteAudio({ stream, silenced = false }: { stream: MediaStream | null; silenced?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    if (stream) el.play().catch(() => {})
  }, [stream])
  return <audio ref={ref} autoPlay playsInline muted={silenced} />
}
