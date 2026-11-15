import type { Socket } from 'socket.io-client'

/**
 * Resolves when the socket connects for the FIRST time, rejects (and closes it) if that first
 * attempt fails.
 *
 * Both listeners are removed as soon as one of them fires. That matters: a `connect_error`
 * listener left behind after a successful connect would fire on the first failed *re*connect
 * attempt, close the socket on purpose, and cancel socket.io's own retrying for good. The app
 * would then show "Reconnecting…" forever.
 */
export function waitForFirstConnect(s: Socket): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const onConnect = () => {
      s.off('connect_error', onError)
      resolve(s)
    }
    const onError = (err: Error) => {
      s.off('connect', onConnect)
      s.disconnect()
      reject(err)
    }
    s.once('connect', onConnect)
    s.once('connect_error', onError)
  })
}

/**
 * socket.io retries a dropped connection by itself, but it gives up for good (`socket.active`
 * is false) when the server refuses a connection attempt (our auth middleware, which also
 * answers UNAUTHORIZED when its database hiccups) or closes us on purpose. From then on only a
 * manual `socket.connect()` helps. These are the rules for doing that by hand.
 */
export const MAX_MANUAL_RETRIES = 6

/** 1s, 2s, 4s, 8s, then 15s: about 45s in total before we tell the person. */
export const manualRetryDelayMs = (attempt: number) => Math.min(1000 * 2 ** attempt, 15_000)

/** The server says this account may not connect at all: retrying cannot help. */
export const isFatalConnectError = (err: Error) => err.message.startsWith('ACCOUNT_')

/** What to tell the person when the retries ran out. Raw codes ("websocket error") mean nothing to them. */
export function describeConnectFailure(why: string): string {
  if (why === 'UNAUTHORIZED') return 'Your sign-in may have expired. Sign in again, then rejoin the room.'
  if (why === 'UNAVAILABLE') return 'The server is having trouble right now. Try again in a minute.'
  return 'The server could not be reached. Check your connection, then rejoin the room.'
}

export interface ManualReconnect {
  /** The server refused or closed us: call connect() again after a pause, or give up after too many tries. */
  schedule(why: string): void
  /** Connected again, or the session is over: forget earlier tries and cancel a pending one. */
  reset(): void
}

export function createManualReconnect(opts: {
  socket: Pick<Socket, 'connect' | 'connected'>
  /** still waiting to get back in (the room store is in its 'reconnecting' state) */
  isWaiting: () => boolean
  giveUp: (why: string) => void
  maxRetries?: number
  delayMs?: (attempt: number) => number
}): ManualReconnect {
  const max = opts.maxRetries ?? MAX_MANUAL_RETRIES
  const delay = opts.delayMs ?? manualRetryDelayMs
  let tries = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  return {
    schedule(why) {
      if (timer || !opts.isWaiting()) return
      if (tries >= max) return opts.giveUp(why)
      timer = setTimeout(() => {
        timer = null
        if (opts.isWaiting() && !opts.socket.connected) opts.socket.connect()
      }, delay(tries++))
    },
    reset() {
      if (timer) clearTimeout(timer)
      timer = null
      tries = 0
    },
  }
}
