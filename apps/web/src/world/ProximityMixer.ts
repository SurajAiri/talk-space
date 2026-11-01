interface Channel {
  stream: MediaStream
  /** muted, only exists because Chromium won't feed a remote stream into Web Audio otherwise */
  el: HTMLAudioElement
  src: MediaStreamAudioSourceNode
  gain: GainNode
}

/**
 * Plays every peer's voice through a per-peer GainNode so volume can follow the
 * hearing rules. Why Web Audio and not `<audio>.volume`: iOS Safari ignores
 * `volume` (it is read-only there), GainNode works everywhere.
 *
 * Known browser quirks handled here:
 *  - Chromium only delivers a remote WebRTC stream to Web Audio while some media
 *    element is also consuming it, so each stream is attached to a muted <audio>.
 *  - AudioContexts start suspended until a user gesture; call resume() from input events.
 *
 * This is receiver-side gating: the audio still travels to everyone. It is a
 * comfort/immersion mechanic, not a privacy boundary (a modified client can ignore it).
 */
export class ProximityMixer {
  private ctx: AudioContext | null = null
  /** every voice passes through this on its way out, so one switch can silence them all */
  private master: GainNode | null = null
  private deafened = false
  private readonly channels = new Map<string, Channel>()

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx
    if (typeof AudioContext === 'undefined') return null
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.deafened ? 0 : 1
    this.master.connect(this.ctx.destination)
    return this.ctx
  }

  /** Silence (or restore) everything we play. Smoothed, so it never clicks. Voices keep arriving meanwhile. */
  setDeafened(deafened: boolean) {
    this.deafened = deafened
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(deafened ? 0 : 1, this.ctx.currentTime, 0.03)
  }

  /** Call from any user gesture (key press, tap). Cheap when already running. */
  resume() {
    const ctx = this.context()
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {})
  }

  attach(id: string, stream: MediaStream) {
    const existing = this.channels.get(id)
    if (existing?.stream === stream) return
    this.detach(id)

    const ctx = this.context()
    if (!ctx) return
    try {
      const el = new Audio()
      el.srcObject = stream
      el.muted = true
      void el.play().catch(() => {})

      const src = ctx.createMediaStreamSource(stream) // throws if the stream has no audio track yet
      const gain = ctx.createGain()
      gain.gain.value = 0 // silent until the first hearing calculation says otherwise
      src.connect(gain).connect(this.master ?? ctx.destination)
      this.channels.set(id, { stream, el, src, gain })
    } catch (err) {
      // No audio track yet: PeerLink calls us again when the track arrives.
      console.warn('[mixer] attach deferred', err)
    }
    this.resume()
  }

  has(id: string) {
    return this.channels.has(id)
  }

  /** 0..1. Smoothed over ~60 ms so walking past someone fades instead of clicking. */
  setGain(id: string, value: number) {
    const ch = this.channels.get(id)
    const ctx = this.ctx
    if (!ch || !ctx) return
    ch.gain.gain.setTargetAtTime(Math.min(1, Math.max(0, value)), ctx.currentTime, 0.06)
  }

  detach(id: string) {
    const ch = this.channels.get(id)
    if (!ch) return
    this.channels.delete(id)
    ch.src.disconnect()
    ch.gain.disconnect()
    ch.el.pause()
    ch.el.srcObject = null
  }

  detachAll() {
    for (const id of [...this.channels.keys()]) this.detach(id)
  }

  close() {
    this.detachAll()
    void this.ctx?.close().catch(() => {})
    this.ctx = null
    this.master = null
  }
}
