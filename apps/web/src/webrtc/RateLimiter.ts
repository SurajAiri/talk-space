/**
 * Token bucket. Allows short bursts up to `capacity`, then a steady `refillPerSecond`.
 * Used on everything a remote peer can make us do, because in a peer-to-peer room
 * nobody but the receiving browser can say "that's too much".
 */
export class TokenBucket {
  private tokens: number
  private last: number
  private readonly capacity: number
  private readonly refillPerSecond: number
  private readonly now: () => number

  constructor(capacity: number, refillPerSecond: number, now: () => number = () => performance.now()) {
    this.capacity = capacity
    this.refillPerSecond = refillPerSecond
    this.now = now
    this.tokens = capacity
    this.last = now()
  }

  /** true = allowed. false = over the limit, drop it. */
  take(cost = 1): boolean {
    const t = this.now()
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.refillPerSecond)
    this.last = t
    if (this.tokens < cost) return false
    this.tokens -= cost
    return true
  }
}

/** Counts events in a sliding window; used to decide that a peer is misbehaving, not just busy. */
export class WindowCounter {
  private stamps: number[] = []
  private readonly windowMs: number
  private readonly now: () => number

  constructor(windowMs: number, now: () => number = () => performance.now()) {
    this.windowMs = windowMs
    this.now = now
  }

  /** Records one event and returns how many happened in the window (including this one). */
  hit(): number {
    const t = this.now()
    this.stamps.push(t)
    const cutoff = t - this.windowMs
    while (this.stamps.length && this.stamps[0]! < cutoff) this.stamps.shift()
    return this.stamps.length
  }

  reset() {
    this.stamps = []
  }
}
