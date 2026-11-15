import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '../store/auth.store'
import { API_URL, SOCKET_PATH } from './config'

let socket: Socket | null = null

/** Opens the signaling socket (JWT-authenticated). Reuses a live one. */
export function connectSocket(): Promise<Socket> {
  if (socket?.connected) return Promise.resolve(socket)
  socket?.disconnect()

  const s = io(API_URL, {
    path: SOCKET_PATH,
    transports: ['websocket'],
    // a phone coming out of a tunnel should not wait 30 s before the next attempt
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    // read at (re)connect time so a refreshed token is picked up
    auth: (cb) => cb({ token: useAuthStore.getState().token }),
  })
  socket = s

  // These two listeners exist ONLY to settle the first connection attempt. They must remove each
  // other once it is settled: a leftover `connect_error` listener would fire on the first failed
  // RECONNECT attempt, call `s.disconnect()` and permanently switch socket.io's auto-reconnect off
  // (the room would sit on "Reconnecting…" forever).
  return new Promise((resolve, reject) => {
    const onConnect = () => {
      s.off('connect_error', onError)
      resolve(s)
    }
    const onError = (err: Error) => {
      s.off('connect', onConnect)
      s.disconnect()
      if (socket === s) socket = null
      reject(err)
    }
    s.once('connect', onConnect)
    s.once('connect_error', onError)
  })
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
