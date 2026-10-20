import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '../store/auth.store'

let socket: Socket | null = null

/** Opens the signaling socket (JWT-authenticated). Reuses a live one. */
export function connectSocket(): Promise<Socket> {
  if (socket?.connected) return Promise.resolve(socket)
  socket?.disconnect()

  const s = io({
    path: '/api/v1/realtime',
    transports: ['websocket'],
    // read at (re)connect time so a refreshed token is picked up
    auth: (cb) => cb({ token: useAuthStore.getState().token }),
  })
  socket = s

  return new Promise((resolve, reject) => {
    s.once('connect', () => resolve(s))
    s.once('connect_error', (err) => {
      s.disconnect()
      if (socket === s) socket = null
      reject(err)
    })
  })
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
