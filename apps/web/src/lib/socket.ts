import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '../store/auth.store'
import { API_URL, SOCKET_PATH } from './config'
import { waitForFirstConnect } from './socketConnect'

let socket: Socket | null = null

/** Opens the signaling socket (JWT-authenticated). Reuses a live one. */
export function connectSocket(): Promise<Socket> {
  if (socket?.connected) return Promise.resolve(socket)
  socket?.disconnect()

  const s = io(API_URL, {
    path: SOCKET_PATH,
    transports: ['websocket'],
    // read at (re)connect time so a refreshed token is picked up
    auth: (cb) => cb({ token: useAuthStore.getState().token }),
  })
  socket = s

  return waitForFirstConnect(s).catch((err: unknown) => {
    if (socket === s) socket = null
    throw err
  })
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
